-- Foundations for job profitability (Austin's Operations Dashboard workbook).
--
-- Built while Austin's pricing and cost answers are outstanding, so nothing
-- here holds a price or a cost: every amount is nullable and starts empty.
-- The answers fill values in; they do not change this shape.
--
--   cost_defaults         per-size fuel, labor and fallback dump fee
--                         (the workbook's Assumptions sheet), all empty
--   disposal_tickets      + disposal_fee_cents: the charge printed on the ticket
--                         + disposal_site_id: where it was tipped
--   disposal_sites        + rate_per_ton_cents: fallback when a ticket has none
--   job_costs             one row per completed job, copied from cost_defaults
--                         at completion so later edits to the defaults do not
--                         rewrite past months
--   profitability_rows()  per-job revenue and costs for a date range, gated by
--                         the 'profitability' permission (admins only by default)
--
-- Nothing in the app reads these yet; the page ships later behind a flag.

create table public.cost_defaults (
  id text primary key default gen_random_uuid()::text,
  dumpster_size text not null unique
    check (dumpster_size in ('10 Yard','20 Yard','30 Yard','40 Yard')),
  fuel_cents bigint check (fuel_cents >= 0),
  labor_cents bigint check (labor_cents >= 0),
  dump_fee_cents bigint check (dump_fee_cents >= 0),
  updated_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cost_defaults_set_updated_at
  before update on public.cost_defaults
  for each row execute function public.set_updated_at();
create trigger cost_defaults_audit
  after insert or update or delete on public.cost_defaults
  for each row execute function public.audit_row_change();

-- Tickets carry no site today, so a per-ton rate has nothing to join on; the
-- site is recorded alongside the charge once the driver screen asks for it.
alter table public.disposal_tickets
  add column disposal_fee_cents bigint check (disposal_fee_cents >= 0),
  add column disposal_site_id text references public.disposal_sites(id) on delete set null;
alter table public.disposal_sites
  add column rate_per_ton_cents bigint check (rate_per_ton_cents >= 0);

create type public.cost_source as enum ('estimated', 'actual');

create table public.job_costs (
  id text primary key default gen_random_uuid()::text,
  job_id text not null unique references public.jobs(id) on delete cascade,
  fuel_cents bigint check (fuel_cents >= 0),
  fuel_source public.cost_source,
  labor_cents bigint check (labor_cents >= 0),
  labor_source public.cost_source,
  -- Snapshot of the size's fallback, used only when no ticket carries a
  -- charge and no site carries a rate.
  default_dump_fee_cents bigint check (default_dump_fee_cents >= 0),
  -- An admin's figure for the dump fee, which beats every derived one.
  dump_fee_override_cents bigint check (dump_fee_override_cents >= 0),
  other_cents bigint not null default 0 check (other_cents >= 0),
  notes text not null default '',
  updated_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger job_costs_set_updated_at
  before update on public.job_costs
  for each row execute function public.set_updated_at();
create trigger job_costs_audit
  after insert or update or delete on public.job_costs
  for each row execute function public.audit_row_change();

alter table public.cost_defaults enable row level security;
alter table public.job_costs enable row level security;

create policy cost_defaults_profitability on public.cost_defaults
  for all to authenticated
  using (public.has_permission('profitability'))
  with check (public.has_permission('profitability'));
create policy job_costs_profitability on public.job_costs
  for all to authenticated
  using (public.has_permission('profitability'))
  with check (public.has_permission('profitability'));

grant select, insert, update, delete on public.cost_defaults to authenticated;
grant select, insert, update, delete on public.job_costs to authenticated;

-- Copy the size's defaults onto a job as it completes. With no defaults set
-- (today) the row is still created, with empty amounts, so every completed
-- job has a place for its costs.
create function public.snapshot_job_costs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  defaults public.cost_defaults;
begin
  if new.status <> 'complete' or old.status = 'complete' or new.deleted_at is not null then
    return new;
  end if;
  select * into defaults from public.cost_defaults where dumpster_size = new.dumpster_size;
  insert into public.job_costs(
    job_id, fuel_cents, fuel_source, labor_cents, labor_source, default_dump_fee_cents
  ) values (
    new.id,
    defaults.fuel_cents, case when defaults.fuel_cents is not null then 'estimated'::public.cost_source end,
    defaults.labor_cents, case when defaults.labor_cents is not null then 'estimated'::public.cost_source end,
    defaults.dump_fee_cents
  ) on conflict (job_id) do nothing;
  return new;
end;
$$;

create trigger jobs_snapshot_job_costs
  after update of status on public.jobs
  for each row execute function public.snapshot_job_costs();

revoke all on function public.snapshot_job_costs() from public, anon, authenticated;

-- Per-job figures for jobs completed in [from_date, through_date], in the
-- company's time zone. Revenue is pre-tax invoice lines on issued invoices
-- (open, paid); invoiced_at is returned too so the page can group by either
-- date once Austin says which one revenue counts on.
--
-- Dump fee, first match wins:
--   admin override -> actual
--   ticket charges -> actual
--   tons x site rate -> estimated
--   size default snapshot -> estimated
create function public.profitability_rows(from_date date, through_date date)
returns table (
  job_id text,
  reference text,
  completed_at timestamptz,
  invoiced_at timestamptz,
  customer_id text,
  customer_name text,
  dumpster_size text,
  service_type text,
  dumpster_code text,
  revenue_cents bigint,
  invoiced boolean,
  dump_fee_cents bigint,
  dump_source public.cost_source,
  fuel_cents bigint,
  fuel_source public.cost_source,
  labor_cents bigint,
  labor_source public.cost_source,
  other_cents bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.has_permission('profitability') then
    raise exception 'Profitability permission required';
  end if;
  return query
  with done as (
    select j.*, e.occurred_at as done_at
    from public.jobs j
    join public.job_events e on e.job_id = j.id and e.event_type = 'completed'
    where j.status = 'complete' and j.deleted_at is null
      and (e.occurred_at at time zone 'America/Los_Angeles')::date between from_date and through_date
  ),
  revenue as (
    select li.job_id, sum(li.amount_cents)::bigint as cents, min(i.issued_at) as first_issued
    from public.invoice_line_items li
    join public.invoices i on i.id = li.invoice_id
    where i.status in ('open','paid') and li.job_id in (select id from done)
    group by li.job_id
  ),
  tickets as (
    select t.job_id,
      sum(t.disposal_fee_cents)::bigint as charged,
      bool_and(t.disposal_fee_cents is not null) as all_charged,
      sum(round(t.net_weight_lbs / 2000.0 * s.rate_per_ton_cents))::bigint as rated,
      bool_and(s.rate_per_ton_cents is not null and t.net_weight_lbs is not null) as all_rated
    from public.disposal_tickets t
    left join public.disposal_sites s on s.id = t.disposal_site_id
    where t.job_id in (select id from done)
    group by t.job_id
  )
  select
    d.id, d.reference, d.done_at, r.first_issued, d.customer_id, c.name,
    d.dumpster_size, d.service_type, dm.code,
    coalesce(r.cents, 0)::bigint, r.job_id is not null,
    case
      when jc.dump_fee_override_cents is not null then jc.dump_fee_override_cents
      when tk.all_charged then tk.charged
      when tk.all_rated then tk.rated
      else jc.default_dump_fee_cents
    end,
    case
      when jc.dump_fee_override_cents is not null or tk.all_charged then 'actual'::public.cost_source
      when tk.all_rated or jc.default_dump_fee_cents is not null then 'estimated'::public.cost_source
    end,
    jc.fuel_cents, jc.fuel_source, jc.labor_cents, jc.labor_source,
    coalesce(jc.other_cents, 0)::bigint
  from done d
  left join public.customers c on c.id = d.customer_id
  left join public.dumpsters dm on dm.id = d.assigned_dumpster_id
  left join public.job_costs jc on jc.job_id = d.id
  left join revenue r on r.job_id = d.id
  left join tickets tk on tk.job_id = d.id
  order by d.done_at;
end;
$$;

revoke all on function public.profitability_rows(date, date) from public, anon;
grant execute on function public.profitability_rows(date, date) to authenticated;

-- Jobs completed before this migration get an empty cost row, so the log has
-- a place for their costs too.
insert into public.job_costs(job_id)
select id from public.jobs where status = 'complete' and deleted_at is null
on conflict (job_id) do nothing;
