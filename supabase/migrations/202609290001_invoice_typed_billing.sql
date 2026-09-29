-- Bill a one-off customer from the invoice itself.
--
-- An invoice copied its billing contact, email and address from the customer
-- record and offered no way to enter them, so a customer booked by typing a
-- name on the job form (which creates a name-only record) could not be invoiced
-- until someone went to Customers and filled in a full profile. Austin's words:
-- "we don't have to create a million profiles for the one off jobs."
--
-- Drafts now accept the billing details typed on the invoice. They are stored
-- on the invoice's own billing snapshot, which is what Stripe is sent, and are
-- written back to the customer only when the office asks for it — or when the
-- invoice itself created the customer. A payload without `billing` behaves
-- exactly as before, copying from the customer.
--
-- A name typed on the invoice that matches no customer now becomes a One-off
-- customer, the same way the job form already resolves a typed name.

create or replace function public.resolve_invoice_customer(payload jsonb)
returns public.customers language plpgsql security definer set search_path='' as $$
declare
  found public.customers;
  wanted text := nullif(trim(coalesce(payload->>'customerId','')),'');
  typed text := nullif(trim(coalesce(payload->>'customerName','')),'');
begin
  if wanted is not null then
    select * into found from public.customers
      where id=wanted and is_active and deleted_at is null;
    if found.id is null then raise exception 'Active customer is required'; end if;
    return found;
  end if;
  if typed is null then raise exception 'Select a customer or type a name'; end if;
  -- Case-insensitive, matching resolve_customer on the job form, so a name
  -- typed in a hurry reuses the account instead of making a second one.
  select * into found from public.customers
    where lower(name)=lower(typed) and is_active and deleted_at is null
    order by created_at limit 1;
  if found.id is not null then return found; end if;
  insert into public.customers(name,customer_group) values(typed,'One-off')
    returning * into found;
  perform public.write_audit('customers',found.id,'create',null,
    jsonb_build_object('name',typed,'source','invoice_form'),null);
  -- Tells create_invoice_draft this customer is new, so the typed billing
  -- details become its profile. Transaction-local.
  perform set_config('sswsco.invoice_created_customer',found.id,true);
  return found;
end;
$$;

-- The billing snapshot an invoice should carry: what was typed, when anything
-- was, otherwise the customer's own billing details as before.
create or replace function public.invoice_billing_snapshot(payload jsonb, customer public.customers)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  typed jsonb := payload->'billing';
  snapshot jsonb;
begin
  if typed is null or jsonb_typeof(typed)<>'object' then
    return jsonb_build_object(
      'contactName',coalesce(nullif(customer.billing_contact_name,''),customer.name),
      'email',coalesce(nullif(customer.billing_email,''),customer.email),
      'phone',customer.phone,
      'addressLine1',coalesce(nullif(customer.billing_address_line1,''),customer.address),
      'addressLine2',customer.billing_address_line2,
      'city',customer.billing_city,
      'state',customer.billing_state,
      'postalCode',customer.billing_postal_code);
  end if;
  snapshot := jsonb_build_object(
    'contactName',trim(coalesce(typed->>'contactName','')),
    'email',lower(trim(coalesce(typed->>'email',''))),
    'phone',trim(coalesce(typed->>'phone','')),
    'addressLine1',trim(coalesce(typed->>'addressLine1','')),
    'addressLine2',trim(coalesce(typed->>'addressLine2','')),
    'city',trim(coalesce(typed->>'city','')),
    'state',upper(trim(coalesce(typed->>'state',''))),
    'postalCode',trim(coalesce(typed->>'postalCode','')));
  -- Blank is allowed on a draft; sending is what requires a complete contact.
  if length(snapshot->>'email')>320
    or (snapshot->>'email'<>'' and snapshot->>'email' !~ '^\S+@\S+\.\S+$')
    then raise exception 'Billing email is not valid'; end if;
  if snapshot->>'state'<>'' and snapshot->>'state' !~ '^[A-Z]{2}$'
    then raise exception 'Billing state must be a two-letter code'; end if;
  if snapshot->>'postalCode'<>'' and snapshot->>'postalCode' !~ '^\d{5}(-\d{4})?$'
    then raise exception 'Billing ZIP code is not valid'; end if;
  return snapshot;
end;
$$;

-- Fill the customer's profile from an invoice's typed details. Dispatch contact
-- fields are only filled where empty, so billing an accounts-payable inbox
-- never overwrites the number a driver calls.
create or replace function public.save_invoice_billing_to_customer(customer public.customers, billing jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare saved public.customers;
begin
  update public.customers set
    billing_contact_name=billing->>'contactName',
    billing_email=billing->>'email',
    billing_address_line1=billing->>'addressLine1',
    billing_address_line2=billing->>'addressLine2',
    billing_city=billing->>'city',
    billing_state=billing->>'state',
    billing_postal_code=billing->>'postalCode',
    email=case when email='' then billing->>'email' else email end,
    phone=case when phone='' then billing->>'phone' else phone end,
    address=case when address='' then billing->>'addressLine1' else address end,
    updated_at=now()
  where id=customer.id returning * into saved;
  perform public.write_audit('customers',customer.id,'update',
    to_jsonb(customer),to_jsonb(saved),'Billing details entered on an invoice');
end;
$$;

create or replace function public.create_invoice_draft(payload jsonb) returns public.invoices
language plpgsql security definer set search_path='' as $$
declare
  saved public.invoices; customer public.customers; revision_source public.invoices;
  item jsonb; job_value text; revised_id text := nullif(payload->>'revisedFromId','');
  jobs jsonb := coalesce(payload->'jobIds','[]'::jsonb);
  items jsonb := coalesce(payload->'items','[]'::jsonb);
  mode public.invoice_billing_mode;
  terms public.invoice_payment_terms;
  billing jsonb;
  created_customer boolean;
begin
  if not public.has_permission('invoices') then raise exception 'Invoices permission required'; end if;
  mode := (payload->>'billingMode')::public.invoice_billing_mode;
  terms := (payload->>'paymentTerms')::public.invoice_payment_terms;
  if mode<>'one_off' and jsonb_array_length(jobs)=0
    then raise exception 'At least one completed job is required'; end if;
  if mode='one_off' and jsonb_array_length(jobs)<>0
    then raise exception 'A one-off invoice carries no jobs'; end if;
  if mode='per_job' and jsonb_array_length(jobs)<>1 then
    raise exception 'Per-job invoices require exactly one job';
  end if;
  if jsonb_array_length(items)=0 then raise exception 'At least one line item is required'; end if;
  customer := public.resolve_invoice_customer(payload);
  created_customer := coalesce(current_setting('sswsco.invoice_created_customer',true),'') = customer.id;
  billing := public.invoice_billing_snapshot(payload, customer);
  if revised_id is not null then
    select * into revision_source from public.invoices where id=revised_id for update;
    if revision_source.id is null or revision_source.status not in ('open','uncollectible')
      then raise exception 'Only an open or uncollectible invoice can be revised'; end if;
    if revision_source.customer_id <> customer.id
      then raise exception 'A revision must keep the original customer'; end if;
    if jsonb_array_length(jobs) <> (select count(*) from public.invoice_jobs where invoice_id=revised_id)
      or exists(select 1 from public.invoice_jobs source_job
        where source_job.invoice_id=revised_id and not (jobs ? source_job.job_id))
      then raise exception 'A revision must keep the original jobs'; end if;
  end if;

  insert into public.invoices(
    invoice_number,customer_id,job_id,amount_cents,status,due_date,notes,
    po_number,created_by_id,billing_mode,payment_terms,billing_contact_name,
    billing_email,billing_address_line1,billing_address_line2,billing_city,
    billing_state,billing_postal_code,billing_country,revised_from_id
  ) values(
    public.next_invoice_number(),customer.id,
    case when mode='per_job' then jobs->>0 else null end,0,'draft',
    current_date + case terms when 'due_on_receipt' then 0 when 'net_15' then 15 else 30 end,
    trim(coalesce(payload->>'notes','')),trim(coalesce(payload->>'poNumber','')),
    public.current_app_user_id(),mode,terms,
    billing->>'contactName',billing->>'email',billing->>'addressLine1',
    billing->>'addressLine2',billing->>'city',billing->>'state',
    billing->>'postalCode','US',
    revised_id
  ) returning * into saved;

  for job_value in select jsonb_array_elements_text(jobs) loop
    if not exists(select 1 from public.jobs where id=job_value
      and customer_id=customer.id and status='complete' and deleted_at is null)
    then raise exception 'Every invoiced job must be complete and belong to the customer'; end if;
    insert into public.invoice_jobs(invoice_id,job_id,active)
    values(saved.id,job_value,saved.revised_from_id is null);
  end loop;

  for item in select * from jsonb_array_elements(items) loop
    if nullif(item->>'jobId','') is not null and not (jobs ? (item->>'jobId')) then
      raise exception 'Line item job must be attached to the invoice';
    end if;
    insert into public.invoice_line_items(
      invoice_id,description,amount_cents,position,job_id,category
    ) values(
      saved.id,trim(item->>'description'),(item->>'amountCents')::bigint,
      coalesce((item->>'position')::integer,0),nullif(item->>'jobId',''),
      coalesce((item->>'category')::public.invoice_line_category,'service')
    );
  end loop;
  select * into saved from public.invoices where id=saved.id;
  if saved.amount_cents <= 0 then raise exception 'Invoice total must be positive'; end if;
  if payload ? 'billing' and (created_customer or coalesce((payload->>'saveBillingToCustomer')::boolean,false))
    then perform public.save_invoice_billing_to_customer(customer, billing); end if;
  return saved;
end;
$$;

create or replace function public.update_invoice_draft(target_invoice_id text, payload jsonb)
returns public.invoices language plpgsql security definer set search_path='' as $$
declare saved public.invoices; customer public.customers; item jsonb; job_value text;
  jobs jsonb := coalesce(payload->'jobIds','[]'::jsonb);
  items jsonb := coalesce(payload->'items','[]'::jsonb);
  mode public.invoice_billing_mode;
  billing jsonb;
begin
  if not public.has_permission('invoices') then raise exception 'Invoices permission required'; end if;
  select * into saved from public.invoices where id=target_invoice_id for update;
  if saved.id is null then raise exception 'Invoice not found'; end if;
  if saved.status<>'draft' or saved.stripe_invoice_id is not null then
    raise exception 'Only unsent drafts can be edited';
  end if;
  if saved.revised_from_id is not null and (
    jsonb_array_length(jobs) <> (select count(*) from public.invoice_jobs where invoice_id=saved.revised_from_id)
    or exists(select 1 from public.invoice_jobs source_job
      where source_job.invoice_id=saved.revised_from_id and not (jobs ? source_job.job_id))
  ) then raise exception 'A revision must keep the original jobs'; end if;
  if (payload->>'customerId') is distinct from saved.customer_id then
    raise exception 'An existing draft cannot change customers';
  end if;
  select * into customer from public.customers
    where id=saved.customer_id and is_active and deleted_at is null;
  if customer.id is null then raise exception 'Active customer is required'; end if;
  mode := (payload->>'billingMode')::public.invoice_billing_mode;
  if (mode<>'one_off' and jsonb_array_length(jobs)=0)
    or (mode='per_job' and jsonb_array_length(jobs)<>1)
    or (mode='one_off' and jsonb_array_length(jobs)<>0)
    then raise exception 'Select the required completed jobs'; end if;
  if jsonb_array_length(items)=0 then raise exception 'At least one line item is required'; end if;
  billing := public.invoice_billing_snapshot(payload, customer);

  update public.invoices set
    billing_mode=mode,
    payment_terms=(payload->>'paymentTerms')::public.invoice_payment_terms,
    due_date=current_date + case (payload->>'paymentTerms')::public.invoice_payment_terms
      when 'due_on_receipt' then 0 when 'net_15' then 15 else 30 end,
    notes=trim(coalesce(payload->>'notes','')),
    po_number=trim(coalesce(payload->>'poNumber','')),
    job_id=case when mode='per_job' then jobs->>0 else null end,
    billing_contact_name=billing->>'contactName',
    billing_email=billing->>'email',
    billing_address_line1=billing->>'addressLine1',
    billing_address_line2=billing->>'addressLine2',
    billing_city=billing->>'city',
    billing_state=billing->>'state',
    billing_postal_code=billing->>'postalCode',
    billing_country='US',
    amount_cents=0,
    amount_remaining_cents=0
  where id=target_invoice_id;
  delete from public.invoice_line_items where invoice_id=target_invoice_id;
  delete from public.invoice_jobs where invoice_id=target_invoice_id;

  for job_value in select jsonb_array_elements_text(jobs) loop
    if not exists(select 1 from public.jobs where id=job_value
      and customer_id=saved.customer_id and status='complete' and deleted_at is null)
    then raise exception 'Every invoiced job must be complete and belong to the customer'; end if;
    insert into public.invoice_jobs(invoice_id,job_id,active)
    values(target_invoice_id,job_value,saved.revised_from_id is null);
  end loop;
  for item in select * from jsonb_array_elements(items) loop
    if nullif(item->>'jobId','') is not null and not (jobs ? (item->>'jobId')) then
      raise exception 'Line item job must be attached to the invoice';
    end if;
    insert into public.invoice_line_items(
      invoice_id,description,amount_cents,position,job_id,category
    ) values(
      target_invoice_id,trim(item->>'description'),(item->>'amountCents')::bigint,
      coalesce((item->>'position')::integer,0),nullif(item->>'jobId',''),
      coalesce((item->>'category')::public.invoice_line_category,'service')
    );
  end loop;
  select * into saved from public.invoices where id=target_invoice_id;
  if saved.amount_cents <= 0 then raise exception 'Invoice total must be positive'; end if;
  if payload ? 'billing' and coalesce((payload->>'saveBillingToCustomer')::boolean,false)
    then perform public.save_invoice_billing_to_customer(customer, billing); end if;
  return saved;
end;
$$;

-- The helpers run only inside the definer functions above.
revoke all on function public.resolve_invoice_customer(jsonb) from public,anon,authenticated;
revoke all on function public.invoice_billing_snapshot(jsonb,public.customers) from public,anon,authenticated;
revoke all on function public.save_invoice_billing_to_customer(public.customers,jsonb) from public,anon,authenticated;
-- Repeated because create-or-replace does not re-run the original grants.
revoke all on function public.create_invoice_draft(jsonb) from public,anon;
revoke all on function public.update_invoice_draft(text,jsonb) from public,anon;
grant execute on function public.create_invoice_draft(jsonb) to authenticated;
grant execute on function public.update_invoice_draft(text,jsonb) to authenticated;
