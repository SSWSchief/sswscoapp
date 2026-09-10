-- A one-off invoice: billable work with no completed job behind it.
--
-- Every layer required at least one completed job, which made a customer the
-- office had just created impossible to invoice — they have no job history yet
-- — and left no way to bill a charge that never was a job: a cleanup fee, a
-- damaged container, a delivery that was quoted and cancelled.
--
-- The job requirement is not relaxed generally. It is relaxed for exactly one
-- new billing mode, and that mode is required to carry no jobs at all, so a
-- per-job or statement invoice cannot quietly become jobless by dropping its
-- selections. Every other guard is untouched: the total must still be positive,
-- line items still must not be zero, and the reviewed billing contact and
-- address are still required before anything is sent.

-- Postgres allows the new label in this transaction; it just cannot be used as
-- a value until the transaction commits. Nothing below evaluates it at apply
-- time — the function bodies are text until they run — so a single migration is
-- safe here.
alter type public.invoice_billing_mode add value if not exists 'one_off';

create or replace function public.create_invoice_draft(payload jsonb) returns public.invoices
language plpgsql security definer set search_path='' as $$
declare
  saved public.invoices; customer public.customers; revision_source public.invoices;
  item jsonb; job_value text; revised_id text := nullif(payload->>'revisedFromId','');
  jobs jsonb := coalesce(payload->'jobIds','[]'::jsonb);
  items jsonb := coalesce(payload->'items','[]'::jsonb);
  mode public.invoice_billing_mode;
  terms public.invoice_payment_terms;
begin
  if not public.has_permission('invoices') then raise exception 'Invoices permission required'; end if;
  mode := (payload->>'billingMode')::public.invoice_billing_mode;
  terms := (payload->>'paymentTerms')::public.invoice_payment_terms;
  select * into customer from public.customers
    where id=payload->>'customerId' and is_active and deleted_at is null;
  if customer.id is null then raise exception 'Active customer is required'; end if;
  if mode<>'one_off' and jsonb_array_length(jobs)=0
    then raise exception 'At least one completed job is required'; end if;
  if mode='one_off' and jsonb_array_length(jobs)<>0
    then raise exception 'A one-off invoice carries no jobs'; end if;
  if mode='per_job' and jsonb_array_length(jobs)<>1 then
    raise exception 'Per-job invoices require exactly one job';
  end if;
  if jsonb_array_length(items)=0 then raise exception 'At least one line item is required'; end if;
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
    coalesce(nullif(customer.billing_contact_name,''),customer.name),
    coalesce(nullif(customer.billing_email,''),customer.email),
    coalesce(nullif(customer.billing_address_line1,''),customer.address),
    customer.billing_address_line2,customer.billing_city,customer.billing_state,
    customer.billing_postal_code,customer.billing_country,
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
  return saved;
end;
$$;

create or replace function public.update_invoice_draft(target_invoice_id text, payload jsonb)
returns public.invoices language plpgsql security definer set search_path='' as $$
declare saved public.invoices; customer public.customers; item jsonb; job_value text;
  jobs jsonb := coalesce(payload->'jobIds','[]'::jsonb);
  items jsonb := coalesce(payload->'items','[]'::jsonb);
  mode public.invoice_billing_mode;
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
  if payload->>'customerId' <> saved.customer_id then
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

  update public.invoices set
    billing_mode=mode,
    payment_terms=(payload->>'paymentTerms')::public.invoice_payment_terms,
    due_date=current_date + case (payload->>'paymentTerms')::public.invoice_payment_terms
      when 'due_on_receipt' then 0 when 'net_15' then 15 else 30 end,
    notes=trim(coalesce(payload->>'notes','')),
    po_number=trim(coalesce(payload->>'poNumber','')),
    job_id=case when mode='per_job' then jobs->>0 else null end,
    billing_contact_name=coalesce(nullif(customer.billing_contact_name,''),customer.name),
    billing_email=coalesce(nullif(customer.billing_email,''),customer.email),
    billing_address_line1=coalesce(nullif(customer.billing_address_line1,''),customer.address),
    billing_address_line2=customer.billing_address_line2,
    billing_city=customer.billing_city,
    billing_state=customer.billing_state,
    billing_postal_code=customer.billing_postal_code,
    billing_country=customer.billing_country,
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
  return saved;
end;
$$;

-- Unchanged from the definitions this replaces, and repeated because
-- create-or-replace does not re-run the original grants.
revoke all on function public.create_invoice_draft(jsonb) from public,anon;
revoke all on function public.update_invoice_draft(text,jsonb) from public,anon;
grant execute on function public.create_invoice_draft(jsonb) to authenticated;
grant execute on function public.update_invoice_draft(text,jsonb) to authenticated;
