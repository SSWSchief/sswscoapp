-- Client workflow extensions: completed-job corrections, pickup planning,
-- cancelled-job archival, post-trip inspections, and managed team channels.

alter table public.jobs
  add column if not exists expected_pickup_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_id text references public.users(id) on delete set null,
  add column if not exists archive_reason text not null default '';

alter table public.container_placements
  add column if not exists expected_pickup_at timestamptz,
  add column if not exists pickup_status text not null default 'not_scheduled',
  add column if not exists pickup_job_id text references public.jobs(id) on delete set null,
  add constraint container_placements_pickup_status_check
    check (pickup_status in ('not_scheduled','needed','scheduled','retrieved'));

alter table public.message_channels
  add column if not exists description text not null default '',
  add column if not exists label text not null default '',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_id text references public.users(id) on delete set null;

create table if not exists public.vehicle_inspections (
  id text primary key default gen_random_uuid()::text,
  inspection_type text not null check (inspection_type in ('pre_trip','post_trip')),
  template_id text not null references public.pretrip_templates(id),
  driver_id text not null references public.users(id),
  truck_id text not null references public.trucks(id),
  mileage integer not null check (mileage >= 0),
  signature text not null,
  results jsonb not null,
  has_failures boolean not null default false,
  safe_to_operate boolean not null,
  defects_found text not null default '',
  repairs_required text not null default '',
  supervisor_signature text not null default '',
  supervisor_signed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (length(defects_found) <= 2000 and length(repairs_required) <= 2000)
);

create table if not exists public.vehicle_inspection_photos (
  id text primary key default gen_random_uuid()::text,
  inspection_id text not null references public.vehicle_inspections(id) on delete cascade,
  storage_path text not null unique,
  url text,
  uploaded_by_id text not null references public.users(id),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-inspection-photos', 'vehicle-inspection-photos', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy vehicle_inspection_storage_read on storage.objects for select to authenticated
  using (bucket_id='vehicle-inspection-photos' and exists(
    select 1 from public.vehicle_inspections i
    where i.id=(storage.foldername(name))[2]
      and (i.driver_id=public.current_app_user_id() or public.current_access_role()='dispatcher' or public.admin_mfa_verified())
  ));
create policy vehicle_inspection_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id='vehicle-inspection-photos' and lower(storage.extension(name))=any(array['jpg','jpeg','png','webp','heic','heif']) and exists(
    select 1 from public.vehicle_inspections i where i.id=(storage.foldername(name))[2] and i.driver_id=public.current_app_user_id()
  ));

alter table public.vehicle_inspections enable row level security;
alter table public.vehicle_inspection_photos enable row level security;

create policy vehicle_inspections_read on public.vehicle_inspections
  for select to authenticated using (
    driver_id = public.current_app_user_id()
    or public.current_access_role() = 'dispatcher'
    or public.admin_mfa_verified()
  );
create policy vehicle_inspections_insert on public.vehicle_inspections
  for insert to authenticated with check (
    driver_id = public.current_app_user_id() and public.has_permission('pre_trip')
  );
create policy vehicle_inspection_photos_read on public.vehicle_inspection_photos
  for select to authenticated using (
    exists (select 1 from public.vehicle_inspections i where i.id = inspection_id
      and (i.driver_id = public.current_app_user_id()
        or public.current_access_role() = 'dispatcher'
        or public.admin_mfa_verified()))
  );
create policy vehicle_inspection_photos_insert on public.vehicle_inspection_photos
  for insert to authenticated with check (
    uploaded_by_id = public.current_app_user_id()
    and exists (select 1 from public.vehicle_inspections i where i.id = inspection_id
      and i.driver_id = public.current_app_user_id())
  );

create or replace function public.correct_completed_job(
  target_job_id text,
  corrected_dumpster_id text,
  correction_reason text,
  corrected_pickup_at timestamptz default null
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.current_app_user_id();
  previous public.jobs;
  changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if length(trim(coalesce(correction_reason,''))) < 3 then raise exception 'A correction reason is required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status <> 'complete' then raise exception 'Only completed jobs can be corrected'; end if;
  if corrected_dumpster_id is null or not exists(select 1 from public.dumpsters where id=corrected_dumpster_id and deleted_at is null) then
    raise exception 'A valid dumpster is required';
  end if;
  update public.jobs set assigned_dumpster_id=corrected_dumpster_id, expected_pickup_at=corrected_pickup_at, updated_at=now()
    where id=target_job_id returning * into changed;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    select target_job_id, actor, u.full_name, 'assigned',
      'Completed job corrected: '||trim(correction_reason), true
    from public.users u where u.id=actor;
  perform public.write_audit('jobs',target_job_id,'correct_completed_job',to_jsonb(previous),to_jsonb(changed),trim(correction_reason));
  return changed;
end;
$$;
revoke all on function public.correct_completed_job(text,text,text,timestamptz) from public, anon;
grant execute on function public.correct_completed_job(text,text,text,timestamptz) to authenticated;

create or replace function public.archive_cancelled_job(target_job_id text, archive_note text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor text := public.current_app_user_id(); changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if length(trim(coalesce(archive_note,''))) < 3 then raise exception 'An archive reason is required'; end if;
  update public.jobs set archived_at=now(), archived_by_id=actor, archive_reason=trim(archive_note), updated_at=now()
    where id=target_job_id and status='cancelled' and deleted_at is null returning * into changed;
  if changed.id is null then raise exception 'Only a non-archived cancelled job can be archived'; end if;
  perform public.write_audit('jobs',target_job_id,'archive',to_jsonb(changed),to_jsonb(changed),trim(archive_note));
  return changed;
end;
$$;
revoke all on function public.archive_cancelled_job(text,text) from public, anon;
grant execute on function public.archive_cancelled_job(text,text) to authenticated;

create or replace function public.set_job_pickup_plan(target_job_id text, pickup_at timestamptz)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  update public.jobs set expected_pickup_at=pickup_at, updated_at=now()
    where id=target_job_id and deleted_at is null returning * into changed;
  if changed.id is null then raise exception 'Job not found'; end if;
  update public.container_placements
    set expected_pickup_at=pickup_at,
        pickup_status=case when pickup_at is null then 'needed' else 'scheduled' end
    where delivered_job_id=target_job_id and retrieved_at is null;
  return changed;
end;
$$;
revoke all on function public.set_job_pickup_plan(text,timestamptz) from public, anon;
grant execute on function public.set_job_pickup_plan(text,timestamptz) to authenticated;

create or replace function public.create_team_message_channel(
  channel_name text,
  channel_label text,
  channel_description text,
  member_ids text[]
) returns public.message_channels language plpgsql security definer set search_path = '' as $$
declare actor text := public.current_app_user_id(); created public.message_channels; member text;
begin
  if not public.admin_mfa_verified() and not public.has_permission('messages') then raise exception 'Messages permission required'; end if;
  if length(trim(coalesce(channel_name,''))) < 2 then raise exception 'Channel name is required'; end if;
  insert into public.message_channels(name,label,description,kind,created_by_id)
    values(trim(channel_name),trim(coalesce(channel_label,'')),trim(coalesce(channel_description,'')),'channel',actor)
    returning * into created;
  insert into public.message_channel_members(channel_id,user_id) values(created.id,actor);
  foreach member in array coalesce(member_ids,array[]::text[]) loop
    insert into public.message_channel_members(channel_id,user_id)
      select created.id, member where exists(select 1 from public.users where id=member and status='active' and deleted_at is null)
      on conflict do nothing;
  end loop;
  return created;
end;
$$;
revoke all on function public.create_team_message_channel(text,text,text,text[]) from public, anon;
grant execute on function public.create_team_message_channel(text,text,text,text[]) to authenticated;