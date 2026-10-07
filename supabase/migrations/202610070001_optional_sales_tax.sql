-- Sales tax becomes a per-invoice choice, off unless the office turns it on.
--
-- Austin, 2026-10-07: the big GCs are quoted an all-in price ($525 for a
-- 40-yard) and expect an invoice for exactly that plus the fuel fee he chooses
-- to add. Tax added on top of every invoice (202610040001) broke that. Sales
-- tax is now a button on the invoice, like the 5% fuel fee: he turns it on for
-- the customers he wants to charge, mostly one-off residential jobs, and SSWS
-- accounts for the tax on the rest itself.
--
--   invoices          + charge_sales_tax: whether Stripe adds the company's
--                       sales tax rate when this invoice is sent
--   *_invoice_draft()   save the choice from payload.chargeSalesTax (absent
--                       means off)
--   sales_tax_rows()    any untaxed invoice now counts toward "tax not
--                       collected", so leaving tax off never hides it from
--                       the return

alter table public.invoices
  add column charge_sales_tax boolean not null default false;

comment on column public.invoices.charge_sales_tax is
  'Office choice: add the company sales tax rate when this invoice is sent.';

-- Invoices already sent keep a true record of what they did. Unsent drafts
-- start off, like every new invoice.
update public.invoices set charge_sales_tax = true where tax_cents > 0;

-- Unchanged from 202609290001 except for charge_sales_tax.

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
    billing_state,billing_postal_code,billing_country,revised_from_id,
    charge_sales_tax
  ) values(
    public.next_invoice_number(),customer.id,
    case when mode='per_job' then jobs->>0 else null end,0,'draft',
    current_date + case terms when 'due_on_receipt' then 0 when 'net_15' then 15 else 30 end,
    trim(coalesce(payload->>'notes','')),trim(coalesce(payload->>'poNumber','')),
    public.current_app_user_id(),mode,terms,
    billing->>'contactName',billing->>'email',billing->>'addressLine1',
    billing->>'addressLine2',billing->>'city',billing->>'state',
    billing->>'postalCode','US',
    revised_id,
    coalesce((payload->>'chargeSalesTax')::boolean,false)
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
    charge_sales_tax=coalesce((payload->>'chargeSalesTax')::boolean,false),
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

-- Repeated because create-or-replace does not re-run the original grants.
revoke all on function public.create_invoice_draft(jsonb) from public,anon;
revoke all on function public.update_invoice_draft(text,jsonb) from public,anon;
grant execute on function public.create_invoice_draft(jsonb) to authenticated;
grant execute on function public.update_invoice_draft(text,jsonb) to authenticated;

-- One row per receipt in [from_date, through_date], company time, splitting
-- each into the sale and the tax inside it in the invoice's own proportion
-- (Stripe's paid amount includes tax). Each receipt's tax is the rounded tax
-- on everything received so far less the rounded tax on what came before, so
-- the receipts of a fully paid invoice add up to exactly its tax, however it
-- was split. `untaxed_cents` is the tax an invoice did not collect -- sent
-- before fixed-rate tax, or sent with tax left off -- at today's rate, so the
-- return can account for it.
create or replace function public.sales_tax_rows(from_date date, through_date date)
returns table (
  payment_id text,
  received_at timestamptz,
  invoice_id text,
  invoice_number text,
  customer_name text,
  billing_mode text,
  invoice_status text,
  tax_rate numeric,
  received_cents bigint,
  sale_cents bigint,
  tax_cents bigint,
  untaxed_cents bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  current_rate numeric;
begin
  if not public.has_permission('invoices') then
    raise exception 'Invoices permission required';
  end if;
  select sales_tax_rate into current_rate from public.company_settings;
  return query
  with receipts as (
    select p.*,
      sum(p.amount_cents) over (
        partition by p.invoice_id order by p.received_at, p.id
      ) as through_this
    from public.invoice_payments p
  ),
  split as (
    select r.*, i.invoice_number, i.billing_contact_name, i.customer_id,
      i.billing_mode, i.status, i.sales_tax_rate, i.tax_cents as invoice_tax,
      (round(r.through_this * i.tax_cents::numeric / nullif(i.amount_cents + i.tax_cents, 0))
        - round((r.through_this - r.amount_cents) * i.tax_cents::numeric
          / nullif(i.amount_cents + i.tax_cents, 0)))::bigint as tax
    from receipts r
    join public.invoices i on i.id = r.invoice_id
  )
  select
    s.id,
    s.received_at,
    s.invoice_id,
    s.invoice_number,
    coalesce(nullif(s.billing_contact_name, ''), c.name, ''),
    s.billing_mode::text,
    s.status::text,
    s.sales_tax_rate,
    s.amount_cents,
    s.amount_cents - coalesce(s.tax, 0),
    coalesce(s.tax, 0),
    case when s.invoice_tax = 0 and coalesce(s.sales_tax_rate, 0) = 0
      then round((s.amount_cents - coalesce(s.tax, 0)) * coalesce(current_rate, 0) / 100)::bigint
      else 0::bigint
    end
  from split s
  left join public.customers c on c.id = s.customer_id
  where (s.received_at at time zone 'America/Los_Angeles')::date between from_date and through_date
  order by s.received_at, s.invoice_number;
end;
$$;

revoke all on function public.sales_tax_rows(date, date) from public, anon;
grant execute on function public.sales_tax_rows(date, date) to authenticated;
