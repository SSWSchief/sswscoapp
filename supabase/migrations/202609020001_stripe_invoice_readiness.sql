-- Stripe invoicing readiness.
--
-- The application remains the operational ledger and Stripe is the immutable
-- delivery/payment rail. Drafts are assembled transactionally here, totals are
-- derived from durable line items, and completed jobs can belong to only one
-- active invoice. Once an invoice is sent, customer/amount/content fields are
-- frozen and lifecycle changes come back from Stripe.

create type public.invoice_lifecycle_status as enum(
  'draft', 'open', 'paid', 'uncollectible', 'void'
);
create type public.invoice_billing_mode as enum('per_job', 'statement');
create type public.invoice_payment_terms as enum(
  'due_on_receipt', 'net_15', 'net_30'
);
create type public.invoice_sync_state as enum(
  'not_started', 'processing', 'synced', 'failed'
);
create type public.invoice_line_category as enum(
  'service', 'rental', 'tonnage', 'fee', 'surcharge', 'adjustment'
);

-- Dedicated billing details remain distinct from dispatch contact details.
-- Existing records are copied as a migration fallback and can be reviewed in
-- the customer editor before the first live invoice is sent.
alter table public.customers
  add column billing_contact_name text not null default '',
  add column billing_email text not null default '',
  add column billing_address_line1 text not null default '',
  add column billing_address_line2 text not null default '',
  add column billing_city text not null default '',
  add column billing_state text not null default '',
  add column billing_postal_code text not null default '',
  add column billing_country text not null default 'US';

update public.customers set
  billing_contact_name = name,
  billing_email = email,
  billing_address_line1 = address
where billing_contact_name = ''
  and billing_email = ''
  and billing_address_line1 = '';

alter table public.customers
  add constraint customers_billing_email_length_check
    check(length(billing_email) <= 320),
  add constraint customers_billing_state_check
    check(billing_state = '' or billing_state ~ '^[A-Z]{2}$'),
  add constraint customers_billing_country_check
    check(billing_country = 'US');

alter table public.company_settings
  add column default_payment_terms public.invoice_payment_terms not null default 'net_30',
  add column tax_policy_status text not null default 'pending'
    check(tax_policy_status in ('pending','non_taxable_approved','follow_up_required')),
  add column tax_policy_approved_at timestamptz,
  add column tax_policy_note text not null default '';

drop function if exists public.save_company_settings(
  text,text,text,text,text,text,integer,text,text
);
create function public.save_company_settings(
  company_name text,
  company_address text,
  company_phone text,
  company_email text,
  company_time_zone text,
  company_date_format text,
  retention_days integer,
  invoice_prefix text,
  invoice_terms text default '',
  default_payment_terms text default 'net_30'
) returns public.company_settings language plpgsql security definer set search_path='' as $$
declare changed public.company_settings;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce($1,''))) < 2 then raise exception 'Company name is required'; end if;
  if nullif(trim(coalesce($4,'')),'') is not null and trim($4) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid company email'; end if;
  if $5 <> 'America/Los_Angeles' then raise exception 'Unsupported time zone'; end if;
  if $6 not in('MM/DD/YYYY','DD/MM/YYYY') then raise exception 'Unsupported date format'; end if;
  if $7 < 30 or $7 > 3650 then raise exception 'Message retention must be between 30 and 3650 days'; end if;
  if upper(trim(coalesce($8,''))) !~ '^[A-Z0-9]{2,12}$' then raise exception 'Invoice prefix must be 2 to 12 letters or numbers'; end if;
  if length(coalesce($9,'')) > 5000 then raise exception 'Invoice terms must be 5000 characters or fewer'; end if;
  if $10 not in('due_on_receipt','net_15','net_30') then raise exception 'Unsupported payment terms'; end if;
  update public.company_settings as settings set
    company_name=trim($1), address=trim(coalesce($2,'')),
    phone=trim(coalesce($3,'')), email=lower(trim(coalesce($4,''))),
    time_zone=$5, date_format=$6, message_retention_days=$7,
    invoice_prefix=upper(trim($8)), invoice_terms=trim(coalesce($9,'')),
    default_payment_terms=$10::public.invoice_payment_terms, updated_at=now()
  where settings.id=true returning settings.* into changed;
  if changed.id is null then raise exception 'Company settings row is missing'; end if;
  return changed;
end;
$$;
grant execute on function public.save_company_settings(
  text,text,text,text,text,text,integer,text,text,text
) to authenticated;

-- Convert the old UI-oriented states to Stripe's canonical lifecycle. Overdue
-- is derived from due_date and "closed" meant uncollectible in the prior code.
drop trigger if exists invoices_stamp_status on public.invoices;
-- Its function goes with it. PostgreSQL does not track types used inside a
-- plpgsql body, so leaving this behind would keep a function referencing the
-- dropped 'sent' and 'closed' states — it would survive the migration and
-- fail only if something ever called it.
drop function if exists public.stamp_invoice_status();
alter table public.invoices
  add column lifecycle_status public.invoice_lifecycle_status not null default 'draft';
update public.invoices set lifecycle_status = case status::text
  when 'draft' then 'draft'::public.invoice_lifecycle_status
  when 'paid' then 'paid'::public.invoice_lifecycle_status
  when 'void' then 'void'::public.invoice_lifecycle_status
  when 'closed' then 'uncollectible'::public.invoice_lifecycle_status
  else 'open'::public.invoice_lifecycle_status
end;
alter table public.invoices drop column status;
alter table public.invoices rename column lifecycle_status to status;
drop type public.invoice_status;

alter table public.invoices
  alter column due_date drop not null,
  add column billing_mode public.invoice_billing_mode not null default 'per_job',
  add column payment_terms public.invoice_payment_terms not null default 'net_30',
  add column billing_contact_name text not null default '',
  add column billing_email text not null default '',
  add column billing_address_line1 text not null default '',
  add column billing_address_line2 text not null default '',
  add column billing_city text not null default '',
  add column billing_state text not null default '',
  add column billing_postal_code text not null default '',
  add column billing_country text not null default 'US',
  add column issued_at timestamptz,
  add column amount_remaining_cents bigint not null default 0,
  add column stripe_sync_state public.invoice_sync_state not null default 'not_started',
  add column stripe_sync_error text,
  add column payment_processing_at timestamptz,
  add column payment_failed_at timestamptz,
  add column last_stripe_event_created bigint,
  add column stripe_customer_id_snapshot text,
  add column revised_from_id text references public.invoices(id) on delete restrict,
  add column latest_revision_id text references public.invoices(id) on delete restrict;

update public.invoices i set
  billing_contact_name = coalesce(nullif(c.billing_contact_name,''), c.name),
  billing_email = coalesce(nullif(c.billing_email,''), c.email),
  billing_address_line1 = coalesce(nullif(c.billing_address_line1,''), c.address),
  billing_address_line2 = c.billing_address_line2,
  billing_city = c.billing_city,
  billing_state = c.billing_state,
  billing_postal_code = c.billing_postal_code,
  billing_country = c.billing_country,
  -- A voided invoice is one that should never have existed, so it carries no
  -- balance. Written-off invoices keep theirs: the debt is still owed, and the
  -- receivable totals count uncollectible while excluding void.
  amount_remaining_cents = case
    when i.status::text = 'void' then 0
    else greatest(i.amount_cents - i.amount_paid_cents, 0)
  end,
  stripe_sync_state = case
    when i.stripe_invoice_id is null then 'not_started'::public.invoice_sync_state
    else 'synced'::public.invoice_sync_state
  end
from public.customers c where c.id = i.customer_id;

alter table public.invoices
  add constraint invoices_number_length_check
    check(length(invoice_number) between 1 and 26),
  add constraint invoices_po_length_check
    check(length(po_number) <= 140),
  add constraint invoices_notes_length_check
    check(length(notes) <= 500),
  add constraint invoices_remaining_check
    check(amount_remaining_cents >= 0),
  add constraint invoices_billing_country_check
    check(billing_country = 'US'),
  add constraint invoices_revision_not_self_check
    check(revised_from_id is null or revised_from_id <> id);

create unique index invoices_revision_source_idx
  on public.invoices(revised_from_id) where revised_from_id is not null;

create table public.invoice_number_counters(
  prefix text primary key check(prefix ~ '^[A-Z0-9]{2,12}$'),
  next_value bigint not null check(next_value > 0),
  updated_at timestamptz not null default now()
);
alter table public.invoice_number_counters enable row level security;

create table public.invoice_line_items(
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null references public.invoices(id) on delete restrict,
  description text not null check(length(trim(description)) between 1 and 500),
  amount_cents bigint not null check(amount_cents <> 0),
  position integer not null check(position >= 0),
  job_id text references public.jobs(id) on delete restrict,
  category public.invoice_line_category not null default 'service',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(invoice_id, position)
);
create index invoice_line_items_invoice_idx
  on public.invoice_line_items(invoice_id, position);
create trigger invoice_line_items_set_updated_at before update
  on public.invoice_line_items for each row execute function public.set_updated_at();
create trigger invoice_line_items_audit after insert or update or delete
  on public.invoice_line_items for each row execute function public.audit_row_change();
alter table public.invoice_line_items enable row level security;
create policy invoice_line_items_read on public.invoice_line_items for select
  to authenticated using(public.has_permission('invoices'));

create table public.invoice_jobs(
  invoice_id text not null references public.invoices(id) on delete restrict,
  job_id text not null references public.jobs(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(invoice_id, job_id)
);
create unique index invoice_jobs_one_active_invoice_idx
  on public.invoice_jobs(job_id) where active;
alter table public.invoice_jobs enable row level security;
create policy invoice_jobs_read on public.invoice_jobs for select
  to authenticated using(public.has_permission('invoices'));

create table public.stripe_webhook_events(
  event_id text primary key,
  event_type text not null,
  object_id text not null,
  livemode boolean not null,
  event_created bigint not null,
  status text not null default 'pending'
    check(status in ('pending','processing','processed','ignored')),
  attempts integer not null default 0 check(attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz
);
create index stripe_webhook_events_pending_idx
  on public.stripe_webhook_events(received_at) where status = 'pending';
alter table public.stripe_webhook_events enable row level security;
create policy stripe_webhook_events_read on public.stripe_webhook_events
  for select to authenticated using(public.has_permission('invoices'));

-- Insert and claim in one database transaction so simultaneous deliveries of
-- the same event cannot both process it. A worker abandoned for five minutes
-- is made claimable again; ordinary processing failures explicitly return the
-- event to pending immediately.
create function public.claim_stripe_webhook_event(
  stripe_event_id text,
  stripe_event_type text,
  stripe_object_id text,
  stripe_livemode boolean,
  stripe_event_created bigint
) returns text language plpgsql security definer set search_path='' as $$
declare claimed text; existing_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  insert into public.stripe_webhook_events(
    event_id,event_type,object_id,livemode,event_created
  ) values(
    stripe_event_id,stripe_event_type,stripe_object_id,stripe_livemode,stripe_event_created
  ) on conflict(event_id) do nothing;
  update public.stripe_webhook_events set
    status='processing', attempts=attempts+1, processing_started_at=now(), last_error=null
  where event_id=stripe_event_id and (
    status='pending' or
    (status='processing' and processing_started_at < now()-interval '5 minutes')
  ) returning status into claimed;
  if claimed is not null then return 'claimed'; end if;
  select status into existing_status from public.stripe_webhook_events
    where event_id=stripe_event_id;
  return coalesce(existing_status,'missing');
end;
$$;
revoke all on function public.claim_stripe_webhook_event(text,text,text,boolean,bigint)
  from public,anon,authenticated;
grant execute on function public.claim_stripe_webhook_event(text,text,text,boolean,bigint)
  to service_role;

-- Recalculate the invoice total after every draft line mutation. Direct table
-- writes are revoked below, so a caller can never submit a contradictory total.
create function public.refresh_invoice_total() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_invoice text := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices set
    amount_cents = coalesce((
      select sum(item.amount_cents) from public.invoice_line_items item
      where item.invoice_id = target_invoice
    ), 0),
    amount_remaining_cents = greatest(coalesce((
      select sum(item.amount_cents) from public.invoice_line_items item
      where item.invoice_id = target_invoice
    ), 0) - amount_paid_cents, 0)
  where id = target_invoice;
  return coalesce(new, old);
end;
$$;
create trigger invoice_line_items_refresh_total
  after insert or update or delete on public.invoice_line_items
  for each row execute function public.refresh_invoice_total();

create function public.freeze_finalized_invoice() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.status in ('paid','void') and new.status <> old.status then
    raise exception 'Paid and void invoices are terminal';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'A finalized invoice cannot return to draft';
  end if;
  if old.status <> 'draft' and (
    new.invoice_number is distinct from old.invoice_number or
    new.customer_id is distinct from old.customer_id or
    new.billing_mode is distinct from old.billing_mode or
    new.payment_terms is distinct from old.payment_terms or
    new.billing_contact_name is distinct from old.billing_contact_name or
    new.billing_email is distinct from old.billing_email or
    new.billing_address_line1 is distinct from old.billing_address_line1 or
    new.billing_address_line2 is distinct from old.billing_address_line2 or
    new.billing_city is distinct from old.billing_city or
    new.billing_state is distinct from old.billing_state or
    new.billing_postal_code is distinct from old.billing_postal_code or
    new.billing_country is distinct from old.billing_country or
    new.amount_cents is distinct from old.amount_cents or
    new.po_number is distinct from old.po_number or
    new.notes is distinct from old.notes
  ) then raise exception 'Finalized invoices are immutable'; end if;
  return new;
end;
$$;
create trigger invoices_freeze_finalized before update on public.invoices
  for each row execute function public.freeze_finalized_invoice();

create function public.freeze_finalized_invoice_line() returns trigger
language plpgsql set search_path='' as $$
declare lifecycle public.invoice_lifecycle_status;
begin
  select status into lifecycle from public.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);
  if lifecycle <> 'draft' then raise exception 'Finalized invoice lines are immutable'; end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_lines_freeze_finalized
  before insert or update or delete on public.invoice_line_items
  for each row execute function public.freeze_finalized_invoice_line();

create function public.release_void_invoice_jobs() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status = 'void' and old.status <> 'void' then
    update public.invoice_jobs set active=false where invoice_id=new.id;
  end if;
  if new.status = 'paid' then new.paid_at=coalesce(new.paid_at,now()); end if;
  if new.status = 'uncollectible' then new.closed_at=coalesce(new.closed_at,now()); end if;
  if new.status = 'open' then new.sent_at=coalesce(new.sent_at,now()); end if;
  return new;
end;
$$;
create trigger invoices_release_jobs_and_stamp before update of status
  on public.invoices for each row execute function public.release_void_invoice_jobs();

-- A transactional counter avoids duplicate numbers under concurrent office
-- use. Prefix changes start/resume their own sequence.
create function public.next_invoice_number() returns text
language plpgsql security definer set search_path='' as $$
declare prefix_value text; sequence_value bigint; result text;
begin
  if not public.has_permission('invoices') then raise exception 'Invoices permission required'; end if;
  select invoice_prefix into prefix_value from public.company_settings where id=true;
  if prefix_value is null then raise exception 'Company settings are missing'; end if;
  insert into public.invoice_number_counters(prefix,next_value)
  values(prefix_value,2)
  on conflict(prefix) do update set
    next_value=public.invoice_number_counters.next_value+1,
    updated_at=now()
  returning next_value-1 into sequence_value;
  result := prefix_value || '-' || lpad(sequence_value::text,6,'0');
  if length(result) > 26 then raise exception 'Invoice number exceeds Stripe limit'; end if;
  return result;
end;
$$;

create function public.create_invoice_draft(payload jsonb) returns public.invoices
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
  if jsonb_array_length(jobs)=0 then raise exception 'At least one completed job is required'; end if;
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

create function public.update_invoice_draft(target_invoice_id text, payload jsonb)
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
  if jsonb_array_length(jobs)=0 or (mode='per_job' and jsonb_array_length(jobs)<>1)
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

-- Browser clients may read invoices and their detail rows, but all writes now
-- pass through the functions/API lifecycle above.
drop policy if exists invoices_write on public.invoices;
revoke insert,update,delete on public.invoices from authenticated;
revoke all on public.invoice_line_items, public.invoice_jobs,
  public.invoice_number_counters, public.stripe_webhook_events from anon;
grant select on public.invoice_line_items, public.invoice_jobs,
  public.stripe_webhook_events to authenticated;
grant all on public.invoice_number_counters, public.invoice_line_items,
  public.invoice_jobs, public.stripe_webhook_events to service_role;

revoke all on function public.refresh_invoice_total() from public,anon,authenticated;
revoke all on function public.freeze_finalized_invoice() from public,anon,authenticated;
revoke all on function public.freeze_finalized_invoice_line() from public,anon,authenticated;
revoke all on function public.release_void_invoice_jobs() from public,anon,authenticated;
revoke all on function public.next_invoice_number() from public,anon;
revoke all on function public.create_invoice_draft(jsonb) from public,anon;
revoke all on function public.update_invoice_draft(text,jsonb) from public,anon;
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.create_invoice_draft(jsonb) to authenticated;
grant execute on function public.update_invoice_draft(text,jsonb) to authenticated;

alter publication supabase_realtime add table public.invoice_line_items;
alter publication supabase_realtime add table public.invoice_jobs;
