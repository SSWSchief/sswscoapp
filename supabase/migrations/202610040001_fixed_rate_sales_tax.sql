-- Nevada sales tax at a fixed rate, and the payment ledger the quarterly
-- return is filed from.
--
-- SSWS's tax accountant (LVB Services) confirmed on 2026-10-02 that sales tax
-- must be charged. Austin's decisions, relayed 2026-10-03:
--   * 8.375% (Clark County) on the whole invoice, every line item;
--   * a sale counts in the quarter it is paid;
--   * no tax-exempt customers and no jobs outside Clark County yet.
--
-- Stripe automatic tax charged 0% because every line went to Stripe as
-- "General - Services", which Nevada does not tax. Invoices now carry a
-- fixed-rate Stripe tax rate instead, so the policy status that meant
-- "automatic tax approved" becomes "fixed rate approved".
--
--   company_settings   + sales_tax_rate: the percentage applied to every line
--                      + stripe_sales_tax_rate_id: the Stripe tax rate holding
--                        it, created by the app on first use
--   invoices           + sales_tax_rate: the percentage the invoice was sent
--                        with (null for invoices sent before this change)
--   invoice_payments   one row per amount received, written by a trigger as
--                      Stripe's amount_paid rises, dated when it was received
--   sales_tax_rows()   the quarterly return's figures, by payment date

alter table public.company_settings
  add column sales_tax_rate numeric(6,3) not null default 8.375
    check (sales_tax_rate >= 0 and sales_tax_rate < 25),
  add column stripe_sales_tax_rate_id text;

comment on column public.company_settings.sales_tax_rate is
  'Sales tax percentage applied to every invoice line (8.375 = Clark County, NV).';
comment on column public.company_settings.stripe_sales_tax_rate_id is
  'Stripe tax rate carrying sales_tax_rate; replaced when the rate changes.';

alter table public.company_settings
  drop constraint if exists company_settings_tax_policy_status_check;

update public.company_settings
set tax_policy_status = 'fixed_rate_approved',
    tax_policy_approved_at = now(),
    tax_policy_note = 'LVB Services, 2026-10-02: sales tax applies. Austin Marshall, 2026-10-03: 8.375% (Clark County) on every invoice line; sales count when paid. Replaces Stripe automatic tax, which classified lines as non-taxable services.'
where tax_policy_status = 'automatic_tax_approved';

alter table public.company_settings
  add constraint company_settings_tax_policy_status_check
  check (tax_policy_status in (
    'pending',
    'fixed_rate_approved',
    'non_taxable_approved',
    'follow_up_required'
  ));

alter table public.invoices
  add column sales_tax_rate numeric(6,3)
    check (sales_tax_rate >= 0 and sales_tax_rate < 25);

comment on column public.invoices.sales_tax_rate is
  'Sales tax percentage the invoice was sent with. Null: sent before fixed-rate tax.';

create table public.invoice_payments (
  id text primary key default gen_random_uuid()::text,
  invoice_id text not null references public.invoices(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  received_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_idx on public.invoice_payments(invoice_id);
create index invoice_payments_received_idx on public.invoice_payments(received_at);

comment on table public.invoice_payments is
  'Money received against an invoice, dated when it arrived. Written by trigger from Stripe''s amount_paid.';

alter table public.invoice_payments enable row level security;
create policy invoice_payments_read on public.invoice_payments
  for select to authenticated using (public.has_permission('invoices'));
grant select on public.invoice_payments to authenticated;

-- Stripe reports a running total, not individual payments. Whatever the total
-- has grown by since the ledger last caught up is one receipt, dated now -- or
-- at Stripe's paid time when this update is the one that settles the invoice.
-- The UPDATE holds the invoice row lock, so two syncs of the same invoice
-- cannot both see the old total and record the same money twice.
create function public.record_invoice_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recorded bigint;
begin
  select coalesce(sum(amount_cents), 0) into recorded
  from public.invoice_payments where invoice_id = new.id;
  if new.amount_paid_cents > recorded then
    insert into public.invoice_payments(invoice_id, amount_cents, received_at)
    values (
      new.id,
      new.amount_paid_cents - recorded,
      case when new.status = 'paid' and new.paid_at is not null then new.paid_at else now() end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.record_invoice_payment() from public, anon, authenticated;

create trigger invoices_record_payment
  after insert or update of amount_paid_cents on public.invoices
  for each row execute function public.record_invoice_payment();

-- Money already received: one receipt per invoice, at its paid time, or its
-- last update for a part-paid one.
insert into public.invoice_payments(invoice_id, amount_cents, received_at)
select id, amount_paid_cents, coalesce(paid_at, updated_at)
from public.invoices
where amount_paid_cents > 0;

-- One row per receipt in [from_date, through_date], company time, splitting
-- each into the sale and the tax inside it in the invoice's own proportion
-- (Stripe's paid amount includes tax). Each receipt's tax is the rounded tax
-- on everything received so far less the rounded tax on what came before, so
-- the receipts of a fully paid invoice add up to exactly its tax, however it
-- was split. `untaxed_cents` is the tax an invoice sent before fixed-rate tax
-- did not collect, at today's rate, so the return can account for it.
create function public.sales_tax_rows(from_date date, through_date date)
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
    case when s.invoice_tax = 0 and s.sales_tax_rate is null
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
