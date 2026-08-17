-- Location checks: an append-only record of where a truck or dumpster was
-- physically confirmed, and by whom.
--
-- Apple publishes no API for reading AirTag positions, so nothing here is fed
-- by Apple. A check is always a person looking somewhere (the Find My app, a
-- driver's radio call, their own eyes) and writing down what they saw. The
-- `source` column records which, so a stale AirTag sighting is never mistaken
-- for a live feed.
create table public.asset_location_checks (
  id text primary key default gen_random_uuid()::text,
  truck_id text references public.trucks(id) on delete cascade,
  dumpster_id text references public.dumpsters(id) on delete cascade,
  source text not null check (source in ('airtag', 'driver_report', 'visual')),
  location text not null check (length(trim(location)) > 0),
  note text not null default '',
  checked_by_id text not null references public.users(id),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Exactly one asset per check. Storing both would let the two disagree.
  constraint asset_location_checks_single_asset check (
    (truck_id is not null and dumpster_id is null)
    or (truck_id is null and dumpster_id is not null)
  )
);

create index asset_location_checks_truck_idx
  on public.asset_location_checks(truck_id, checked_at desc)
  where truck_id is not null;
create index asset_location_checks_dumpster_idx
  on public.asset_location_checks(dumpster_id, checked_at desc)
  where dumpster_id is not null;
create index asset_location_checks_checked_at_idx
  on public.asset_location_checks(checked_at desc);

alter table public.asset_location_checks enable row level security;

-- Asset positions are internal operational data: staff read, staff write.
-- Drivers see their own job addresses, not the whole fleet's whereabouts.
create policy asset_location_checks_staff_read
  on public.asset_location_checks for select to authenticated
  using (public.is_staff());

-- The log is append-only and self-attributed: you cannot file a check under
-- someone else's name, and recorded history is never edited or deleted.
create policy asset_location_checks_staff_insert
  on public.asset_location_checks for insert to authenticated
  with check (public.is_staff() and checked_by_id = public.current_app_user_id());

alter publication supabase_realtime add table public.asset_location_checks;
