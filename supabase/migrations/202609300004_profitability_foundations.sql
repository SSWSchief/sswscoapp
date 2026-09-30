-- Foundations for job profitability (Austin's Operations Dashboard workbook),
-- shaped by his answers of 2026-09-30:
--   * prices stay as the rate card in Overwatch has them;
--   * drivers record each landfill ticket's tonnage and charge on the job;
--   * fuel follows the miles actually run (yard -> job -> dump or yard) at the
--     current diesel price, never a flat rate;
--   * revenue counts when invoiced, split into received and still owed;
--   * management eyes only.
-- Labor is still unanswered, so it takes the workbook's $88 per haul as an
-- editable default.
--
--   operating_costs      one row: yard address, current diesel price
--   trucks               + mpg
--   cost_defaults        per-size labor and fallback dump fee
--   disposal_tickets     + disposal_fee_cents: the charge on the ticket
--                        + disposal_site_id: where it was tipped
--   disposal_sites       + rate_per_ton_cents: fallback when a ticket has none
--   job_costs            one row per completed job; the labor default, the
--                        truck's mpg and the diesel price are copied in at
--                        completion so later changes do not rewrite past months
--   profitability_rows() per-job revenue, received, and costs for a range,
--                        gated by the 'profitability' permission (admins only)
--
-- Nothing in the app reads these yet; the page ships later behind a flag.

create table public.operating_costs (
  id boolean primary key default true check (id),
  -- Where every route starts and ends. Null means the company address.
  yard_address text,
  diesel_cents_per_gallon bigint check (diesel_cents_per_gallon > 0),
  updated_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.operating_costs(id) values (true);

create table public.cost_defaults (
  id text primary key default gen_random_uuid()::text,
  dumpster_size text not null unique
    check (dumpster_size in ('10 Yard','20 Yard','30 Yard','40 Yard')),
  labor_cents bigint check (labor_cents >= 0),
  dump_fee_cents bigint check (dump_fee_cents >= 0),
  updated_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- $88 per haul is the only labor figure SSWS has given (both workbook sheets).
insert into public.cost_defaults(dumpster_size, labor_cents) values
  ('10 Yard', 8800), ('20 Yard', 8800), ('30 Yard', 8800), ('40 Yard', 8800);

create trigger operating_costs_set_updated_at
  before update on public.operating_costs
  for each row execute function public.set_updated_at();
create trigger operating_costs_audit
  after insert or update or delete on public.operating_costs
  for each row execute function public.audit_row_change();
create trigger cost_defaults_set_updated_at
  before update on public.cost_defaults
  for each row execute function public.set_updated_at();
create trigger cost_defaults_audit
  after insert or update or delete on public.cost_defaults
  for each row execute function public.audit_row_change();

alter table public.trucks
  add column mpg numeric(5,2) check (mpg > 0);

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
  -- Fuel: route miles / mpg x diesel, or an admin's figure over all of it.
  route_miles numeric(7,1) check (route_miles >= 0),
  mpg numeric(5,2) check (mpg > 0),
  diesel_cents_per_gallon bigint check (diesel_cents_per_gallon > 0),
  fuel_override_cents bigint check (fuel_override_cents >= 0),
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

alter table public.operating_costs enable row level security;
alter table public.cost_defaults enable row level security;
alter table public.job_costs enable row level security;

create policy operating_costs_profitability on public.operating_costs
  for all to authenticated
  using (public.has_permission('profitability'))
  with check (public.has_permission('profitability'));
create policy cost_defaults_profitability on public.cost_defaults
  for all to authenticated
  using (public.has_permission('profitability'))
  with check (public.has_permission('profitability'));
create policy job_costs_profitability on public.job_costs
  for all to authenticated
  using (public.has_permission('profitability'))
  with check (public.has_permission('profitability'));

-- One settings row: it can be read and changed, never added to or removed.
grant select, update on public.operating_costs to authenticated;
grant select, insert, update, delete on public.cost_defaults to authenticated;
grant select, insert, update, delete on public.job_costs to authenticated;

-- Copy what a job's costs depend on as it completes. Anything not yet set
-- (diesel price, truck mpg) is copied as empty and the fuel stays open.
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
    job_id, mpg, diesel_cents_per_gallon, labor_cents, labor_source, default_dump_fee_cents
  ) values (
    new.id,
    (select mpg from public.trucks where id = new.assigned_truck_id),
    (select diesel_cents_per_gallon from public.operating_costs),
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

-- Per-job figures for jobs completed OR first invoiced in [from_date,
-- through_date], company time, so a report on either date basis has them all.
--
-- Revenue is pre-tax lines on issued invoices (open, paid). Received is the
-- job's share of what Stripe has collected: a paid invoice in full, an open
-- one in proportion (Stripe's paid amount includes tax, the lines do not).
--
-- Fuel: admin figure -> actual; miles / mpg x diesel -> estimated; else empty.
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
  received_cents bigint,
  invoiced boolean,
  dump_fee_cents bigint,
  dump_source public.cost_source,
  route_miles numeric,
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
  with completed as (
    select j.*, e.occurred_at as done_at
    from public.jobs j
    join public.job_events e on e.job_id = j.id and e.event_type = 'completed'
    where j.status = 'complete' and j.deleted_at is null
  ),
  revenue as (
    select li.job_id,
      sum(li.amount_cents)::bigint as cents,
      sum(case
        when i.status = 'paid' then li.amount_cents
        else round(li.amount_cents * least(1, i.amount_paid_cents::numeric
          / nullif(i.amount_cents + i.tax_cents, 0)))
      end)::bigint as received,
      min(i.issued_at) as first_issued
    from public.invoice_line_items li
    join public.invoices i on i.id = li.invoice_id
    where i.status in ('open','paid') and li.job_id in (select id from completed)
    group by li.job_id
  ),
  done as (
    select c.*, r.cents, r.received, r.first_issued, r.job_id is not null as billed
    from completed c
    left join revenue r on r.job_id = c.id
    where (c.done_at at time zone 'America/Los_Angeles')::date between from_date and through_date
       or (r.first_issued at time zone 'America/Los_Angeles')::date between from_date and through_date
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
    d.id, d.reference, d.done_at, d.first_issued, d.customer_id, c.name,
    d.dumpster_size, d.service_type, dm.code,
    coalesce(d.cents, 0)::bigint, coalesce(d.received, 0)::bigint, d.billed,
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
    jc.route_miles,
    case
      when jc.fuel_override_cents is not null then jc.fuel_override_cents
      else round(jc.route_miles / jc.mpg * jc.diesel_cents_per_gallon)::bigint
    end,
    case
      when jc.fuel_override_cents is not null then 'actual'::public.cost_source
      when jc.route_miles is not null and jc.mpg is not null and jc.diesel_cents_per_gallon is not null
        then 'estimated'::public.cost_source
    end,
    jc.labor_cents, jc.labor_source,
    coalesce(jc.other_cents, 0)::bigint
  from done d
  left join public.customers c on c.id = d.customer_id
  left join public.dumpsters dm on dm.id = d.assigned_dumpster_id
  left join public.job_costs jc on jc.job_id = d.id
  left join tickets tk on tk.job_id = d.id
  order by d.done_at;
end;
$$;

revoke all on function public.profitability_rows(date, date) from public, anon;
grant execute on function public.profitability_rows(date, date) to authenticated;

-- Jobs completed before this migration get a cost row, with the labor
-- default, so the log has a place for their costs too.
insert into public.job_costs(job_id, labor_cents, labor_source)
select j.id, d.labor_cents, case when d.labor_cents is not null then 'estimated'::public.cost_source end
from public.jobs j
left join public.cost_defaults d on d.dumpster_size = j.dumpster_size
where j.status = 'complete' and j.deleted_at is null
on conflict (job_id) do nothing;
