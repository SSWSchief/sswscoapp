-- Billing needs two facts the platform has never recorded.
--
-- The rate sheet charges a base that includes a rental period and a disposal
-- weight allowance -- 7 days and 4 tons on a 20 yard, 14 days and 6 tons on a
-- 40 -- and bills everything past those allowances by the ton and by the day.
-- Neither quantity exists anywhere today: nothing captures the scale ticket a
-- driver comes back with, and a delivery and its eventual pick-up are two
-- unrelated `jobs` rows with nothing tying them together, so there is no span
-- to count days across.
--
-- This migration records only those facts. It deliberately holds no prices,
-- no allowances and no overage rates: the rate card is a separate change, and
-- an invoice that reads through to a live rate would change after it was
-- issued. Tonnage and days land here; money is applied on top later.

-- Disposal tickets -----------------------------------------------------------

create table public.disposal_tickets (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  ticket_number text not null default '',
  vendor_id text references public.vendors(id) on delete set null,
  -- Scale tickets are written in pounds, so pounds is what gets stored: the
  -- number on the paper survives into the database unrounded, and tons are
  -- derived at billing time rather than at data entry.
  gross_weight_lbs integer check (gross_weight_lbs is null or gross_weight_lbs >= 0),
  tare_weight_lbs integer check (tare_weight_lbs is null or tare_weight_lbs >= 0),
  net_weight_lbs integer not null check (net_weight_lbs >= 0),
  weighed_at timestamptz not null default now(),
  -- Photo of the ticket, following the same storage convention as job_photos.
  storage_path text unique,
  notes text not null default '',
  recorded_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One haul, one ticket. Correcting a mistyped weight is an update, never a
  -- second row -- two rows for one trip would be billed as two loads.
  unique (job_id)
);

comment on table public.disposal_tickets is
  'Scale ticket for one haul, in pounds as written on the ticket. Overage tonnage is computed from this against the rate card in force when the invoice is issued.';

create trigger disposal_tickets_set_updated_at
  before update on public.disposal_tickets
  for each row execute function public.set_updated_at();
create trigger disposal_tickets_audit
  after insert or update or delete on public.disposal_tickets
  for each row execute function public.audit_row_change();

alter table public.disposal_tickets enable row level security;

-- Dispatch works tickets through the job they belong to, so the job
-- permission gates staff. A driver may see and file the ticket for a job
-- assigned to them and nothing else.
create policy disposal_tickets_read on public.disposal_tickets
  for select to authenticated using (
    public.has_permission('jobs')
    or exists (
      select 1 from public.jobs j
      where j.id = disposal_tickets.job_id
        and j.assigned_driver_id = public.current_app_user_id()
        and j.deleted_at is null
    )
  );
create policy disposal_tickets_staff_write on public.disposal_tickets
  for all to authenticated
  using (public.has_permission('jobs'))
  with check (public.has_permission('jobs'));

create index disposal_tickets_job_idx on public.disposal_tickets (job_id);
create index disposal_tickets_weighed_idx on public.disposal_tickets (weighed_at);

-- Drivers file tickets only through this function, the same way they move a
-- job's status: the write is audited, the job assignment is checked, and a
-- re-file corrects the existing ticket rather than adding a second one.
create function public.record_disposal_ticket(
  target_job_id text,
  net_lbs integer,
  ticket_no text default '',
  disposal_vendor_id text default null,
  gross_lbs integer default null,
  tare_lbs integer default null,
  weighed timestamptz default null,
  ticket_storage_path text default null,
  ticket_notes text default ''
) returns public.disposal_tickets language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
  saved public.disposal_tickets;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('jobs') and not exists (
    select 1 from public.jobs
    where id = target_job_id
      and assigned_driver_id = app_user_id
      and deleted_at is null
  ) then raise exception 'Job is not assigned to this user'; end if;
  if net_lbs is null or net_lbs < 0 then raise exception 'Net weight is required'; end if;
  if gross_lbs is not null and tare_lbs is not null and gross_lbs < tare_lbs then
    raise exception 'Gross weight cannot be less than tare weight';
  end if;

  insert into public.disposal_tickets(
    job_id, ticket_number, vendor_id, gross_weight_lbs, tare_weight_lbs,
    net_weight_lbs, weighed_at, storage_path, notes, recorded_by_id
  ) values (
    target_job_id, coalesce(trim(ticket_no), ''), disposal_vendor_id, gross_lbs, tare_lbs,
    net_lbs, coalesce(weighed, now()), ticket_storage_path, coalesce(ticket_notes, ''), app_user_id
  )
  on conflict (job_id) do update set
    ticket_number = excluded.ticket_number,
    vendor_id = excluded.vendor_id,
    gross_weight_lbs = excluded.gross_weight_lbs,
    tare_weight_lbs = excluded.tare_weight_lbs,
    net_weight_lbs = excluded.net_weight_lbs,
    weighed_at = excluded.weighed_at,
    storage_path = coalesce(excluded.storage_path, public.disposal_tickets.storage_path),
    notes = excluded.notes,
    recorded_by_id = excluded.recorded_by_id
  returning * into saved;

  select full_name into actor from public.users where id = app_user_id;
  insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
    values (
      target_job_id, app_user_id, actor, 'note',
      'Disposal ticket recorded: ' || round(net_lbs / 2000.0, 2)::text || ' tons', true
    );
  return saved;
end;
$$;

revoke all on function public.record_disposal_ticket(text, integer, text, text, integer, integer, timestamptz, text, text) from public, anon;
grant execute on function public.record_disposal_ticket(text, integer, text, text, integer, integer, timestamptz, text, text) to authenticated, service_role;

-- Container placements -------------------------------------------------------

create table public.container_placements (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id),
  dumpster_id text not null references public.dumpsters(id),
  address text not null,
  delivered_job_id text references public.jobs(id) on delete set null,
  retrieved_job_id text references public.jobs(id) on delete set null,
  delivered_at timestamptz not null,
  retrieved_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint container_placements_span_check
    check (retrieved_at is null or retrieved_at >= delivered_at)
);

comment on table public.container_placements is
  'One container standing at one jobsite, from the delivery that put it there to the pick-up that brought it back. Billable rental days are the span; the included period and day rate are applied from the rate card at invoice time.';

-- A container is in one place at a time. This is the invariant that keeps
-- rental spans from overlapping and double-billing a single can.
create unique index container_placements_open_idx
  on public.container_placements (dumpster_id) where retrieved_at is null;
create index container_placements_customer_idx
  on public.container_placements (customer_id, delivered_at);

create trigger container_placements_set_updated_at
  before update on public.container_placements
  for each row execute function public.set_updated_at();
create trigger container_placements_audit
  after insert or update or delete on public.container_placements
  for each row execute function public.audit_row_change();

alter table public.container_placements enable row level security;

create policy container_placements_read on public.container_placements
  for select to authenticated using (
    public.has_permission('jobs') or public.has_permission('dumpsters')
  );
create policy container_placements_staff_write on public.container_placements
  for all to authenticated
  using (public.has_permission('jobs'))
  with check (public.has_permission('jobs'));

-- Placements are maintained by the work itself rather than by anyone
-- remembering to record them. A trigger on the job -- not the driver's status
-- function -- so a job completed by dispatch keeps the same books as one
-- completed from a truck.
--
-- ASSUMPTION -- 'Swap / Exchange'. A swap drops a fresh container and takes the
-- full one away, but a job carries a single assigned_dumpster_id and so cannot
-- name both. This reads that container as the one going OUT, and treats
-- whatever is currently standing at the job's address as the one coming back.
-- That is the ordinary convention, but it is a guess until SSWS confirms how
-- they record a swap. If the assigned container turns out to be the one being
-- collected, swap the two dumpster references in the branch below -- nothing
-- else in the model depends on the direction. See docs/billing-assumptions.md.
--
-- 'Dump & Return' is intentionally a no-op too, and correctly so: the can goes
-- to the landfill and comes back to the same site, so the rental never breaks.
-- It produces a disposal ticket, not a placement change.
create function public.sync_container_placement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  container text := new.assigned_dumpster_id;
begin
  if new.status <> 'complete' or old.status = 'complete' then return new; end if;
  if container is null or new.deleted_at is not null then return new; end if;

  if new.service_type = 'Delivery' then
    -- Close anything still open for this container before opening the next
    -- span; an unclosed prior placement means a pick-up went unrecorded, and
    -- the partial unique index would otherwise reject the new row outright.
    update public.container_placements
      set retrieved_at = new.updated_at
      where dumpster_id = container and retrieved_at is null;
    insert into public.container_placements(
      customer_id, dumpster_id, address, delivered_job_id, delivered_at
    ) values (new.customer_id, container, new.address, new.id, new.updated_at);

  elsif new.service_type = 'Pick-Up' then
    update public.container_placements
      set retrieved_at = new.updated_at, retrieved_job_id = new.id
      where dumpster_id = container and retrieved_at is null;

  elsif new.service_type = 'Swap / Exchange' then
    -- The full can leaving the site is whatever is open at this address, which
    -- is not the container named on the job. Close it against this job first.
    update public.container_placements
      set retrieved_at = new.updated_at, retrieved_job_id = new.id
      where retrieved_at is null
        and customer_id = new.customer_id
        and address = new.address
        and dumpster_id <> container;
    -- The arriving can should not already be standing somewhere; if it is, an
    -- earlier pick-up went unrecorded and the open span would collide with the
    -- partial unique index below.
    update public.container_placements
      set retrieved_at = new.updated_at
      where dumpster_id = container and retrieved_at is null;
    insert into public.container_placements(
      customer_id, dumpster_id, address, delivered_job_id, delivered_at
    ) values (new.customer_id, container, new.address, new.id, new.updated_at);

  elsif new.service_type = 'Relocation' then
    -- The same can moves to a new address on the same rental, so the span
    -- continues and only the address changes.
    update public.container_placements
      set address = new.address
      where dumpster_id = container and retrieved_at is null;
  end if;

  return new;
end;
$$;

create trigger jobs_sync_container_placement
  after update of status on public.jobs
  for each row execute function public.sync_container_placement();

revoke all on function public.sync_container_placement() from public, anon, authenticated;
