-- SSWSCO Overwatch Phase 1 schema, authorization, realtime, and photo storage.
create extension if not exists pgcrypto;

create type public.user_role as enum ('dispatcher', 'driver', 'office', 'management');
create type public.access_role as enum ('admin', 'dispatcher', 'driver');
create type public.employee_status as enum ('active', 'inactive');
create type public.job_status as enum ('pending', 'en_route', 'arrived', 'complete', 'cancelled');
create type public.truck_status as enum ('in_use', 'down', 'in_shop');
create type public.dumpster_status as enum ('out', 'in_yard', 'in_shop');
create type public.notification_category as enum ('job_assignment', 'dispatch_update', 'driver_status', 'dry_run');
create type public.job_activity_type as enum ('created', 'assigned', 'en_route', 'arrived', 'dry_run', 'completed', 'note');
create type public.time_entry_type as enum ('clock_in', 'break_start', 'break_end', 'clock_out');

create table public.users (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_id text not null unique,
  full_name text not null,
  email text not null unique,
  phone text not null default '',
  role public.user_role not null,
  access_role public.access_role not null,
  permission_overrides jsonb not null default '{}'::jsonb,
  status public.employee_status not null default 'active',
  initials text not null,
  pto_balance_hours numeric(8,2),
  weekly_hours numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  customer_group text check (customer_group in ('Big GC', 'Commercial', 'Residential')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trucks (
  id text primary key default gen_random_uuid()::text,
  number text not null unique,
  type text not null,
  status public.truck_status not null default 'in_use',
  license_plate text not null default '',
  registration_due_date date,
  mileage integer not null default 0 check (mileage >= 0),
  last_pm_date date,
  last_pm_mileage integer not null default 0 check (last_pm_mileage >= 0),
  next_pm_date date,
  next_pm_mileage integer not null default 0 check (next_pm_mileage >= 0),
  make text not null default '',
  model text not null default '',
  vin text not null default '',
  assigned_driver_id text references public.users(id) on delete set null,
  current_job_id text,
  notes text not null default '',
  air_tag_id text,
  gps_source text check (gps_source in ('manual', 'airtag', 'gps_placeholder')),
  last_known_location text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dumpsters (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  size text not null check (size in ('10 Yard', '20 Yard', '30 Yard', '40 Yard')),
  status public.dumpster_status not null default 'in_yard',
  type text not null default 'Roll-off',
  current_customer_id text references public.customers(id) on delete set null,
  current_location text not null default 'Yard',
  current_job_id text,
  air_tag_id text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.job_reference_seq start with 1052;
create table public.jobs (
  id text primary key default gen_random_uuid()::text,
  reference text not null unique default ('#' || nextval('public.job_reference_seq')),
  customer_id text not null references public.customers(id),
  address text not null,
  phone text not null default '',
  service_type text not null check (service_type in ('Delivery', 'Pick-Up', 'Dump & Return', 'Swap / Exchange', 'Relocation', 'Dry Run', 'Service Call')),
  dumpster_size text not null check (dumpster_size in ('10 Yard', '20 Yard', '30 Yard', '40 Yard')),
  assigned_driver_id text references public.users(id) on delete set null,
  assigned_truck_id text references public.trucks(id) on delete set null,
  assigned_dumpster_id text references public.dumpsters(id) on delete set null,
  scheduled_for timestamptz not null,
  status public.job_status not null default 'pending',
  notes text not null default '',
  traffic_instructions text,
  created_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trucks add constraint trucks_current_job_fk foreign key (current_job_id) references public.jobs(id) on delete set null;
alter table public.dumpsters add constraint dumpsters_current_job_fk foreign key (current_job_id) references public.jobs(id) on delete set null;

create table public.job_events (
  job_id text not null references public.jobs(id) on delete cascade,
  event_type public.job_activity_type not null,
  occurred_at timestamptz,
  primary key (job_id, event_type)
);

create table public.job_notes (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  author_id text not null references public.users(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table public.job_photos (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  storage_path text unique,
  url text,
  uploaded_by_id text not null references public.users(id),
  created_at timestamptz not null default now()
);

create table public.job_activities (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  actor_id text not null references public.users(id),
  actor_name text not null,
  activity_type public.job_activity_type not null,
  body text not null,
  dispatch_notified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  recipient_user_id text not null references public.users(id) on delete cascade,
  source_role public.access_role not null,
  category public.notification_category not null,
  title text not null,
  body text not null,
  related_job_id text references public.jobs(id) on delete cascade,
  requires_acknowledgement boolean not null default true,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  entry_type public.time_entry_type not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.time_requests (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('edit_time', 'pto')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_for date not null,
  hours numeric(6,2) not null check (hours >= 0),
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.absence_events (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete cascade,
  event_date date not null,
  absence_type text not null check (absence_type in ('pto', 'sick', 'unavailable')),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index jobs_driver_schedule_idx on public.jobs(assigned_driver_id, scheduled_for);
create index jobs_schedule_status_idx on public.jobs(scheduled_for, status);
create index notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index activities_job_created_idx on public.job_activities(job_id, created_at desc);
create index time_entries_user_occurred_idx on public.time_entries(user_id, occurred_at desc);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger trucks_set_updated_at before update on public.trucks for each row execute function public.set_updated_at();
create trigger dumpsters_set_updated_at before update on public.dumpsters for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create trigger time_requests_set_updated_at before update on public.time_requests for each row execute function public.set_updated_at();

create function public.current_app_user_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.users where auth_user_id = auth.uid() and status = 'active' limit 1
$$;

create function public.current_access_role() returns public.access_role
language sql stable security definer set search_path = '' as $$
  select access_role from public.users where auth_user_id = auth.uid() and status = 'active' limit 1
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_access_role() in ('admin', 'dispatcher'), false)
$$;

grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.current_access_role() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Link an invited Auth account to its pre-created employee record by email.
create function public.link_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users set auth_user_id = new.id where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end;
$$;
create trigger link_auth_user_after_insert after insert on auth.users for each row execute function public.link_auth_user();

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.trucks enable row level security;
alter table public.dumpsters enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_activities enable row level security;
alter table public.notifications enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_requests enable row level security;
alter table public.absence_events enable row level security;

create policy users_read on public.users for select to authenticated using (public.is_staff() or id = public.current_app_user_id());
create policy users_admin_update on public.users for update to authenticated using (public.current_access_role() = 'admin') with check (public.current_access_role() = 'admin');

create policy customers_read on public.customers for select to authenticated using (true);
create policy customers_staff_write on public.customers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy trucks_read on public.trucks for select to authenticated using (true);
create policy trucks_staff_write on public.trucks for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy dumpsters_read on public.dumpsters for select to authenticated using (true);
create policy dumpsters_staff_write on public.dumpsters for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy jobs_read on public.jobs for select to authenticated using (public.is_staff() or assigned_driver_id = public.current_app_user_id());
create policy jobs_staff_insert on public.jobs for insert to authenticated with check (public.is_staff());
create policy jobs_staff_update on public.jobs for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy jobs_staff_delete on public.jobs for delete to authenticated using (public.is_staff());

create policy job_events_read on public.job_events for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id));
create policy job_events_staff_write on public.job_events for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy job_notes_read on public.job_notes for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id));
create policy job_notes_insert on public.job_notes for insert to authenticated with check (author_id = public.current_app_user_id() and exists (select 1 from public.jobs j where j.id = job_id));
create policy job_photos_read on public.job_photos for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id));
create policy job_photos_insert on public.job_photos for insert to authenticated with check (uploaded_by_id = public.current_app_user_id() and exists (select 1 from public.jobs j where j.id = job_id));
create policy job_activities_read on public.job_activities for select to authenticated using (exists (select 1 from public.jobs j where j.id = job_id));
create policy job_activities_insert on public.job_activities for insert to authenticated with check (actor_id = public.current_app_user_id() and exists (select 1 from public.jobs j where j.id = job_id));

create policy notifications_read on public.notifications for select to authenticated using (recipient_user_id = public.current_app_user_id());
create policy notifications_ack on public.notifications for update to authenticated using (recipient_user_id = public.current_app_user_id()) with check (recipient_user_id = public.current_app_user_id());
create policy notifications_staff_insert on public.notifications for insert to authenticated with check (public.is_staff());
create policy time_entries_read on public.time_entries for select to authenticated using (public.is_staff() or user_id = public.current_app_user_id());
create policy time_entries_insert on public.time_entries for insert to authenticated with check (user_id = public.current_app_user_id());
create policy time_requests_read on public.time_requests for select to authenticated using (public.is_staff() or user_id = public.current_app_user_id());
create policy time_requests_insert on public.time_requests for insert to authenticated with check (user_id = public.current_app_user_id());
create policy time_requests_staff_update on public.time_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy absence_read on public.absence_events for select to authenticated using (public.is_staff() or user_id = public.current_app_user_id());
create policy absence_insert on public.absence_events for insert to authenticated with check (user_id = public.current_app_user_id());
create policy absence_staff_update on public.absence_events for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Drivers update operational status only through this audited function.
create function public.update_assigned_job_status(target_job_id text, next_status public.job_status)
returns void language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
  event_name public.job_activity_type;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_staff() and not exists (
    select 1 from public.jobs where id = target_job_id and assigned_driver_id = app_user_id
  ) then raise exception 'Job is not assigned to this user'; end if;

  select full_name into actor from public.users where id = app_user_id;
  event_name := case when next_status = 'complete' then 'completed'::public.job_activity_type else next_status::text::public.job_activity_type end;
  update public.jobs set status = next_status where id = target_job_id;
  insert into public.job_events(job_id, event_type, occurred_at) values (target_job_id, event_name, now())
    on conflict (job_id, event_type) do update set occurred_at = excluded.occurred_at;
  insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
    values (target_job_id, app_user_id, actor, event_name, case when next_status = 'complete' then 'Job completed by driver' else 'Driver marked ' || replace(next_status::text, '_', ' ') end, true);
  insert into public.notifications(recipient_user_id, source_role, category, title, body, related_job_id)
    select u.id, 'driver', 'driver_status', actor || ': ' || j.reference, 'Job status changed to ' || replace(next_status::text, '_', ' '), j.id
    from public.jobs j cross join lateral (
      select id from public.users where access_role in ('admin', 'dispatcher') and status = 'active' order by created_at limit 1
    ) u where j.id = target_job_id;
end;
$$;
grant execute on function public.update_assigned_job_status(text, public.job_status) to authenticated;

create function public.log_assigned_job_dry_run(target_job_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.is_staff() and not exists (
    select 1 from public.jobs where id = target_job_id and assigned_driver_id = app_user_id
  ) then raise exception 'Job is not assigned to this user'; end if;
  select full_name into actor from public.users where id = app_user_id;
  insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
    values (target_job_id, app_user_id, actor, 'dry_run', 'Dry run logged from driver portal', true);
  insert into public.notifications(recipient_user_id, source_role, category, title, body, related_job_id)
    select u.id, 'driver', 'dry_run', actor || ': ' || j.reference, 'Dry run logged. Dispatch acknowledgement requested.', j.id
    from public.jobs j cross join lateral (
      select id from public.users where access_role in ('admin', 'dispatcher') and status = 'active' order by created_at limit 1
    ) u where j.id = target_job_id;
end;
$$;
grant execute on function public.log_assigned_job_dry_run(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy job_photo_storage_read on storage.objects for select to authenticated
using (bucket_id = 'job-photos' and exists (
  select 1 from public.jobs j where j.id = (storage.foldername(name))[1]
));
create policy job_photo_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'job-photos' and exists (
  select 1 from public.jobs j where j.id = (storage.foldername(name))[1]
));
create policy job_photo_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'job-photos' and (owner_id = auth.uid()::text or public.is_staff()));

alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.job_activities;
alter publication supabase_realtime add table public.job_notes;
alter publication supabase_realtime add table public.job_photos;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.trucks;
alter publication supabase_realtime add table public.dumpsters;
