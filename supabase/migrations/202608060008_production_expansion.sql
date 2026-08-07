-- Production expansion: enforce permissions at the data boundary, correct
-- operational state transitions, and activate the previously deferred modules.

-- Granular permission enforcement ------------------------------------------------
drop policy if exists customers_staff_write on public.customers;
drop policy if exists trucks_staff_write on public.trucks;
drop policy if exists dumpsters_staff_write on public.dumpsters;
drop policy if exists jobs_staff_insert on public.jobs;
drop policy if exists jobs_staff_update on public.jobs;
drop policy if exists jobs_staff_delete on public.jobs;
drop policy if exists users_admin_update on public.users;
drop policy if exists users_admin_insert on public.users;
drop policy if exists users_admin_delete on public.users;
drop policy if exists users_read on public.users;
drop policy if exists jobs_read on public.jobs;
drop policy if exists time_entries_read on public.time_entries;
drop policy if exists time_requests_read on public.time_requests;
drop policy if exists absence_read on public.absence_events;
drop policy if exists time_corrections_read on public.time_entry_corrections;
drop policy if exists audit_staff_read on public.audit_log;
drop policy if exists trucks_read on public.trucks;
drop policy if exists job_events_staff_write on public.job_events;
drop policy if exists job_activities_insert on public.job_activities;
drop policy if exists notifications_staff_insert on public.notifications;
drop policy if exists time_entries_insert on public.time_entries;
drop policy if exists time_requests_staff_update on public.time_requests;
drop policy if exists absence_staff_update on public.absence_events;
drop policy if exists time_requests_insert on public.time_requests;
drop policy if exists absence_insert on public.absence_events;
drop policy if exists job_photos_read on public.job_photos;
drop policy if exists job_photos_insert on public.job_photos;
drop policy if exists job_photo_storage_read on storage.objects;
drop policy if exists job_photo_storage_insert on storage.objects;
drop policy if exists job_photo_storage_delete on storage.objects;

create or replace function public.admin_mfa_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt()->>'aal') = 'aal2', false)
    and exists(select 1 from public.users where auth_user_id=auth.uid() and access_role='admin' and status='active' and deleted_at is null)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(public.current_access_role()='dispatcher' or public.admin_mfa_verified(),false)
$$;

create policy users_scoped_read on public.users for select to authenticated using(id=public.current_app_user_id() or public.has_permission('employees') or (public.current_access_role()='dispatcher' and (public.has_permission('jobs') or public.has_permission('time_clock'))));
create policy jobs_scoped_read on public.jobs for select to authenticated using(public.has_permission('jobs') or (public.has_permission('driver_jobs') and assigned_driver_id=public.current_app_user_id()));
create policy trucks_scoped_read on public.trucks for select to authenticated using(public.has_permission('trucks') or public.has_permission('pre_trip') or exists(select 1 from public.jobs j where j.assigned_truck_id=trucks.id and j.assigned_driver_id=public.current_app_user_id() and j.deleted_at is null));
create policy time_entries_scoped_read on public.time_entries for select to authenticated using(user_id=public.current_app_user_id() or public.admin_mfa_verified() or (public.current_access_role()='dispatcher' and public.has_permission('time_clock')));
create policy time_requests_scoped_read on public.time_requests for select to authenticated using(user_id=public.current_app_user_id() or public.admin_mfa_verified() or (public.current_access_role()='dispatcher' and public.has_permission('time_clock')));
create policy absence_scoped_read on public.absence_events for select to authenticated using(user_id=public.current_app_user_id() or public.has_permission('absence'));
create policy time_corrections_scoped_read on public.time_entry_corrections for select to authenticated using(user_id=public.current_app_user_id() or public.admin_mfa_verified() or (public.current_access_role()='dispatcher' and public.has_permission('time_clock')));
create policy audit_admin_read on public.audit_log for select to authenticated using(public.admin_mfa_verified());
alter table public.users add constraint users_role_access_compatible check((role='driver')=(access_role='driver') and (role<>'management' or access_role='admin')) not valid;
create function public.preserve_active_administrator() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.access_role='admin' and old.status='active' and old.deleted_at is null
    and (tg_op='DELETE' or new.access_role<>'admin' or new.status<>'active' or new.deleted_at is not null)
    and not exists(select 1 from public.users u where u.id<>old.id and u.access_role='admin' and u.status='active' and u.deleted_at is null)
  then raise exception 'At least one active administrator is required'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger users_preserve_active_admin before update or delete on public.users for each row execute function public.preserve_active_administrator();

create policy customers_permission_insert on public.customers for insert to authenticated
  with check (public.has_permission('customers'));
create policy customers_permission_update on public.customers for update to authenticated
  using (public.has_permission('customers')) with check (public.has_permission('customers'));
create policy customers_permission_delete on public.customers for delete to authenticated
  using (public.has_permission('customers'));
create policy trucks_permission_insert on public.trucks for insert to authenticated
  with check (public.has_permission('trucks'));
create policy trucks_permission_update on public.trucks for update to authenticated
  using (public.has_permission('trucks')) with check (public.has_permission('trucks'));
create policy trucks_permission_delete on public.trucks for delete to authenticated
  using (public.has_permission('trucks'));
create policy dumpsters_permission_insert on public.dumpsters for insert to authenticated
  with check (public.has_permission('dumpsters'));
create policy dumpsters_permission_update on public.dumpsters for update to authenticated
  using (public.has_permission('dumpsters')) with check (public.has_permission('dumpsters'));
create policy dumpsters_permission_delete on public.dumpsters for delete to authenticated
  using (public.has_permission('dumpsters'));
create policy time_requests_own_insert on public.time_requests for insert to authenticated
  with check(user_id=public.current_app_user_id() and public.has_permission('time_clock') and status='pending' and reviewed_by_id is null and reviewed_at is null);
create policy job_photos_scoped_read on public.job_photos for select to authenticated using(exists(select 1 from public.jobs j where j.id=job_id and (j.assigned_driver_id=public.current_app_user_id() or public.has_permission('jobs'))));
create policy job_photos_scoped_insert on public.job_photos for insert to authenticated with check(uploaded_by_id=public.current_app_user_id() and exists(select 1 from public.jobs j where j.id=job_id and (j.assigned_driver_id=public.current_app_user_id() or public.has_permission('jobs'))));
create policy job_photo_storage_scoped_read on storage.objects for select to authenticated using(bucket_id='job-photos' and exists(select 1 from public.jobs j where j.id=(storage.foldername(name))[1] and (j.assigned_driver_id=public.current_app_user_id() or public.has_permission('jobs'))));
create policy job_photo_storage_scoped_insert on storage.objects for insert to authenticated with check(bucket_id='job-photos' and lower(storage.extension(name))=any(array['jpg','jpeg','png','webp','heic']) and exists(select 1 from public.jobs j where j.id=(storage.foldername(name))[1] and (j.assigned_driver_id=public.current_app_user_id() or public.has_permission('jobs'))));
create policy job_photo_storage_scoped_delete on storage.objects for delete to authenticated using(bucket_id='job-photos' and owner_id=auth.uid()::text and exists(select 1 from public.jobs j where j.id=(storage.foldername(name))[1] and (j.assigned_driver_id=public.current_app_user_id() or public.has_permission('jobs'))));

-- Job writes are RPC-only. Direct client updates could otherwise bypass the
-- photo, transition, assignment, notification, and audit invariants.

-- Scheduled assignments do not mutate physical asset state. Assets are reserved
-- only while a job is en_route/arrived, allowing sequential future scheduling.
create or replace function public.reserve_job_assets(next_job public.jobs)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if next_job.status not in ('en_route','arrived') then return; end if;
  perform public.assert_active_user(next_job.assigned_driver_id, 'driver');
  if next_job.assigned_driver_id is null then raise exception 'Assign a driver before starting the job'; end if;

  if next_job.assigned_truck_id is not null then
    perform 1 from public.trucks
      where id=next_job.assigned_truck_id and deleted_at is null and status='in_use'
        and (current_job_id is null or current_job_id=next_job.id) for update;
    if not found then raise exception 'Selected truck is active on another job or unavailable'; end if;
    update public.trucks set current_job_id=next_job.id, assigned_driver_id=next_job.assigned_driver_id,
      last_known_location=next_job.address, last_seen_at=now() where id=next_job.assigned_truck_id;
  end if;

  if next_job.assigned_dumpster_id is not null then
    perform 1 from public.dumpsters
      where id=next_job.assigned_dumpster_id and deleted_at is null and status <> 'in_shop'
        and (current_job_id is null or current_job_id=next_job.id) for update;
    if not found then raise exception 'Selected dumpster is active on another job or unavailable'; end if;
    update public.dumpsters set current_job_id=next_job.id, current_customer_id=next_job.customer_id,
      current_location=next_job.address, status='out' where id=next_job.assigned_dumpster_id;
  end if;
end;
$$;

create or replace function public.create_job(
  customer_id text, job_address text, job_phone text, service text, container_size text,
  driver_id text, truck_id text, dumpster_id text, schedule_at timestamptz,
  job_notes text default '', traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; created public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if not exists(select 1 from public.customers where id=customer_id and is_active and deleted_at is null) then raise exception 'Active customer is required'; end if;
  perform public.assert_active_user(driver_id, 'driver');
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.jobs(customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,notes,traffic_instructions,created_by_id)
  values(customer_id,trim(job_address),trim(coalesce(job_phone,'')),service,container_size,driver_id,truck_id,dumpster_id,schedule_at,trim(coalesce(job_notes,'')),nullif(trim(coalesce(traffic,'')),''),actor_id)
  returning * into created;
  insert into public.job_events(job_id,event_type,occurred_at) values
    (created.id,'created',now()),(created.id,'assigned',case when driver_id is null then null else now() end),(created.id,'en_route',null),(created.id,'arrived',null),(created.id,'completed',null);
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    values(created.id,actor_id,actor_name,'created',created.reference||case when driver_id is null then ' created unassigned.' else ' created and assigned.' end,true);
  if driver_id is not null then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
      values(driver_id,'dispatcher','job_assignment','New job assigned: '||created.reference,service||' at '||job_address||'. Please acknowledge this assignment.',created.id);
  end if;
  perform public.write_audit('jobs',created.id,'create',null,to_jsonb(created),null);
  return created;
end;
$$;

create or replace function public.edit_job(
  target_job_id text, customer_id text, job_address text, job_phone text, service text,
  container_size text, driver_id text, truck_id text, dumpster_id text,
  schedule_at timestamptz, job_notes text default '', traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text:=public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status <> 'pending' then raise exception 'Only pending jobs can be edited'; end if;
  if not exists(select 1 from public.customers where id=customer_id and is_active and deleted_at is null) then raise exception 'Active customer is required'; end if;
  perform public.assert_active_user(driver_id,'driver');
  update public.jobs set customer_id=edit_job.customer_id,address=trim(job_address),phone=trim(coalesce(job_phone,'')),
    service_type=service,dumpster_size=container_size,assigned_driver_id=driver_id,assigned_truck_id=truck_id,
    assigned_dumpster_id=dumpster_id,scheduled_for=schedule_at,notes=trim(coalesce(job_notes,'')),
    traffic_instructions=nullif(trim(coalesce(traffic,'')),'') where id=target_job_id returning * into changed;
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    values(target_job_id,actor_id,actor_name,'assigned','Job details or assignments updated.',true);
  if driver_id is not null and driver_id is distinct from previous.assigned_driver_id then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
      values(driver_id,'dispatcher','job_assignment','Job assigned: '||changed.reference,'You have been assigned '||changed.reference||'.',target_job_id);
  end if;
  perform public.write_audit('jobs',target_job_id,'edit',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;

create or replace function public.assign_job(target_job_id text, driver_id text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text:=public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  perform public.assert_active_user(driver_id,'driver');
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null or previous.status <> 'pending' then raise exception 'Only pending jobs can be assigned'; end if;
  update public.jobs set assigned_driver_id=driver_id where id=target_job_id returning * into changed;
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,'assigned',now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values(target_job_id,actor_id,actor_name,'assigned','Driver assignment updated.',true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id) values(driver_id,'dispatcher','job_assignment','Job assigned: '||changed.reference,'You have been assigned '||changed.reference||'.',target_job_id);
  perform public.write_audit('jobs',target_job_id,'assign_driver',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;

create or replace function public.cancel_job(target_job_id text,cancel_reason text)
returns public.jobs language plpgsql security definer set search_path='' as $$
declare previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if length(trim(coalesce(cancel_reason,'')))<3 then raise exception 'Cancellation reason is required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null or previous.status in('complete','cancelled') then raise exception 'Only an open job can be cancelled'; end if;
  update public.jobs set status='cancelled',cancellation_reason=trim(cancel_reason) where id=target_job_id returning * into changed;
  perform public.release_job_assets(changed);
  perform public.write_audit('jobs',target_job_id,'cancel',to_jsonb(previous),to_jsonb(changed),cancel_reason);
  return changed;
end;
$$;

create or replace function public.complete_job_as_dispatch(target_job_id text,override_reason text default null)
returns public.jobs language plpgsql security definer set search_path='' as $$
declare previous public.jobs; changed public.jobs; has_photo boolean;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null or previous.status<>'arrived' then raise exception 'Only an arrived job can be completed'; end if;
  select exists(select 1 from public.job_photos where job_id=target_job_id) into has_photo;
  if not has_photo and length(trim(coalesce(override_reason,'')))<3 then raise exception 'An override reason is required when no photo exists'; end if;
  update public.jobs set status='complete' where id=target_job_id returning * into changed;
  perform public.release_job_assets(changed);
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,'completed',now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  perform public.write_audit('jobs',target_job_id,'dispatcher_complete',to_jsonb(previous),to_jsonb(changed),override_reason);
  return changed;
end;
$$;

create or replace function public.update_assigned_job_status(target_job_id text,next_status public.job_status)
returns void language plpgsql security definer set search_path = '' as $$
declare app_user_id text:=public.current_app_user_id(); actor text; event_name public.job_activity_type; target public.jobs; changed public.jobs;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  select * into target from public.jobs where id=target_job_id and deleted_at is null for update;
  if target.id is null then raise exception 'Job not found'; end if;
  if target.assigned_driver_id is distinct from app_user_id then raise exception 'Job is not assigned to this user'; end if;
  if not public.has_permission('driver_jobs') then raise exception 'Driver jobs permission required'; end if;
  if not ((target.status='pending' and next_status='en_route') or (target.status='en_route' and next_status='arrived') or (target.status='arrived' and next_status='complete')) then
    raise exception 'Invalid job status transition from % to %',target.status,next_status;
  end if;
  if next_status='complete' and not exists(select 1 from public.job_photos where job_id=target_job_id) then raise exception 'At least one completion photo is required'; end if;
  select full_name into actor from public.users where id=app_user_id;
  event_name:=case when next_status='complete' then 'completed'::public.job_activity_type else next_status::text::public.job_activity_type end;
  update public.jobs set status=next_status where id=target_job_id returning * into changed;
  if next_status='complete' then perform public.release_job_assets(changed); else perform public.reserve_job_assets(changed); end if;
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,event_name,now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values(target_job_id,app_user_id,actor,event_name,case when next_status='complete' then 'Job completed' else 'Driver marked '||replace(next_status::text,'_',' ') end,true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
    select u.id,'driver','driver_status',actor||': '||target.reference,'Job status changed to '||replace(next_status::text,'_',' '),target.id from public.users u where u.access_role in('admin','dispatcher') and u.status='active' and u.deleted_at is null;
end;
$$;

drop function if exists public.log_assigned_job_dry_run(text);
create function public.log_assigned_job_dry_run(target_job_id text,dry_run_reason text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare app_user_id text:=public.current_app_user_id(); actor text; previous public.jobs; changed public.jobs;
begin
  if length(trim(coalesce(dry_run_reason,'')))<3 then raise exception 'Dry-run reason is required'; end if;
  if not public.has_permission('driver_jobs') then raise exception 'Driver jobs permission required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null or previous.assigned_driver_id is distinct from app_user_id then raise exception 'Job is not assigned to this user'; end if;
  if previous.status not in('en_route','arrived') then raise exception 'Only an active job can be marked dry run'; end if;
  update public.jobs set status='cancelled',cancellation_reason='Dry run: '||trim(dry_run_reason) where id=target_job_id returning * into changed;
  perform public.release_job_assets(changed);
  select full_name into actor from public.users where id=app_user_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values(target_job_id,app_user_id,actor,'dry_run','Dry run: '||trim(dry_run_reason),true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
    select u.id,'driver','dry_run',actor||': '||previous.reference,'Dry run: '||trim(dry_run_reason),previous.id from public.users u where u.access_role in('admin','dispatcher') and u.status='active' and u.deleted_at is null;
  perform public.write_audit('jobs',target_job_id,'dry_run',to_jsonb(previous),to_jsonb(changed),dry_run_reason);
  return changed;
end;
$$;
grant execute on function public.log_assigned_job_dry_run(text,text) to authenticated;

create or replace function public.record_time_event(next_type public.time_entry_type)
returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare app_user_id text:=public.current_app_user_id(); previous public.time_entry_type; created public.time_entries; allowed boolean:=false;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('time_clock') then raise exception 'Time clock permission required'; end if;
  perform pg_advisory_xact_lock(hashtext(app_user_id));
  select entry_type into previous from public.time_entries where user_id=app_user_id order by occurred_at desc limit 1;
  allowed := (previous is null and next_type='clock_in') or (previous='clock_out' and next_type='clock_in')
    or (previous='clock_in' and next_type in('break_start','clock_out'))
    or (previous='break_start' and next_type='break_end')
    or (previous='break_end' and next_type in('break_start','clock_out'));
  if not allowed then raise exception 'Invalid time event after %',coalesce(previous::text,'no prior event'); end if;
  insert into public.time_entries(user_id,entry_type,occurred_at) values(app_user_id,next_type,now()) returning * into created;
  perform public.write_audit('time_entries',created.id,'create',null,to_jsonb(created),null);
  return created;
end;
$$;

create or replace function public.review_time_request(request_id text,decision text)
returns public.time_requests language plpgsql security definer set search_path='' as $$
declare reviewer text:=public.current_app_user_id(); request public.time_requests;
begin
  if not public.has_permission('time_clock') then raise exception 'Time clock permission required'; end if;
  if decision not in('approved','denied') then raise exception 'Decision must be approved or denied'; end if;
  update public.time_requests set status=decision,reviewed_by_id=reviewer,reviewed_at=now() where id=request_id and status='pending' returning * into request;
  if request.id is null then raise exception 'Pending request not found'; end if;
  if decision='approved' and request.kind='edit_time' then
    if request.requested_entry_type is null or request.requested_at is null then raise exception 'Correction details are incomplete'; end if;
    insert into public.time_entry_corrections(request_id,original_entry_id,user_id,replacement_type,replacement_at,reason,approved_by_id)
      values(request.id,request.target_entry_id,request.user_id,request.requested_entry_type,request.requested_at,request.reason,reviewer);
  elsif decision='approved' and request.kind='pto' then
    insert into public.absence_events(user_id,event_date,absence_type,status,note) values(request.user_id,request.requested_for,'pto','approved',request.reason);
  end if;
  perform public.write_audit('time_requests',request.id,'review',null,to_jsonb(request),decision);
  return request;
end;
$$;

create or replace function public.audit_admin_action(target_user_id text,admin_action text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  if admin_action not in('invite_created','password_reset_initiated','status_active','status_inactive','access_role_changed','permissions_changed') then raise exception 'Unsupported administrative action'; end if;
  perform public.write_audit('users',target_user_id,admin_action,null,null,null);
end;
$$;

-- Activated modules --------------------------------------------------------------
create type public.invoice_status as enum('draft','sent','paid','overdue','closed','void');
create table public.invoices(
  id text primary key default gen_random_uuid()::text,
  invoice_number text not null unique,
  customer_id text not null references public.customers(id),
  job_id text references public.jobs(id),
  amount_cents bigint not null check(amount_cents>=0),
  status public.invoice_status not null default 'draft',
  due_date date not null,
  notes text not null default '',
  sent_at timestamptz, paid_at timestamptz, closed_at timestamptz,
  created_by_id text references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger invoices_audit after insert or update or delete on public.invoices for each row execute function public.audit_row_change();

create table public.message_channels(id text primary key default gen_random_uuid()::text,name text not null,kind text not null check(kind in('channel','direct','announcement')),created_by_id text references public.users(id),created_at timestamptz not null default now());
create table public.message_channel_members(channel_id text references public.message_channels(id) on delete cascade,user_id text references public.users(id) on delete cascade,primary key(channel_id,user_id));
create table public.messages(id text primary key default gen_random_uuid()::text,channel_id text not null references public.message_channels(id) on delete cascade,sender_id text not null references public.users(id),body text not null check(length(trim(body))>0),created_at timestamptz not null default now());
create table public.message_reads(message_id text references public.messages(id) on delete cascade,user_id text references public.users(id) on delete cascade,read_at timestamptz not null default now(),primary key(message_id,user_id));

create table public.pretrip_templates(id text primary key default gen_random_uuid()::text,title text not null,version integer not null,is_published boolean not null default false,items jsonb not null default '[]',created_by_id text references public.users(id),created_at timestamptz not null default now(),unique(title,version));
create table public.pretrip_submissions(id text primary key default gen_random_uuid()::text,template_id text not null references public.pretrip_templates(id),driver_id text not null references public.users(id),truck_id text not null references public.trucks(id),mileage integer not null check(mileage>=0),signature text not null,results jsonb not null,has_failures boolean not null default false,submitted_at timestamptz not null default now());
create function public.notify_pretrip_failure() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.has_failures then insert into public.notifications(recipient_user_id,source_role,category,title,body,requires_acknowledgement) select id,'driver','dispatch_update','Pre-trip requires review','A driver submitted a pre-trip inspection with failed items.',true from public.users where access_role in('admin','dispatcher') and status='active' and deleted_at is null; end if; return new; end; $$;
create trigger pretrip_failure_notify after insert on public.pretrip_submissions for each row execute function public.notify_pretrip_failure();
create table public.sop_documents(id text primary key default gen_random_uuid()::text,title text not null,category text not null,version integer not null,body text not null,is_published boolean not null default false,required_for_drivers boolean not null default true,created_by_id text references public.users(id),created_at timestamptz not null default now(),unique(title,version));
create table public.sop_acknowledgements(sop_id text references public.sop_documents(id) on delete cascade,user_id text references public.users(id) on delete cascade,acknowledged_at timestamptz not null default now(),primary key(sop_id,user_id));
create function public.retire_prior_sop_versions() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.is_published then update public.sop_documents set is_published=false where title=new.title and is_published; end if; return new; end; $$;
create trigger sop_retire_prior before insert on public.sop_documents for each row execute function public.retire_prior_sop_versions();
create table public.company_settings(id boolean primary key default true check(id),company_name text not null default 'Silver State Waste Solutions',address text not null default '',phone text not null default '',email text not null default '',time_zone text not null default 'America/Los_Angeles',date_format text not null default 'MM/DD/YYYY',message_retention_days integer not null default 365,invoice_prefix text not null default 'INV',updated_at timestamptz not null default now(),
  constraint company_settings_company_name_check check(length(trim(company_name)) between 2 and 120),
  constraint company_settings_email_check check(email='' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint company_settings_time_zone_check check(time_zone in('America/Los_Angeles')),
  constraint company_settings_date_format_check check(date_format in('MM/DD/YYYY','DD/MM/YYYY')),
  constraint company_settings_retention_check check(message_retention_days between 30 and 3650),
  constraint company_settings_invoice_prefix_check check(invoice_prefix ~ '^[A-Z0-9]{2,12}$')
);
insert into public.company_settings(id) values(true) on conflict do nothing;
insert into public.message_channels(name,kind) values('Company Announcements','announcement'),('Dispatch','channel');
insert into public.pretrip_templates(title,version,is_published,items) values('Daily Truck Pre-Trip',1,true,'[{"id":"tires","label":"Tires and wheels"},{"id":"lights","label":"Lights and reflectors"},{"id":"brakes","label":"Brakes"},{"id":"fluids","label":"Fluid leaks and levels"},{"id":"safety","label":"Safety equipment"},{"id":"body","label":"Body, hoist, and container equipment"}]');
create table public.export_audit(id text primary key default gen_random_uuid()::text,export_type text not null,filters jsonb not null default '{}',row_count integer not null,requested_by_id text not null references public.users(id),created_at timestamptz not null default now());
create table public.import_runs(id text primary key default gen_random_uuid()::text,source_name text not null,source_hash text not null unique,status text not null check(status in('validated','applied','failed')),counts jsonb not null default '{}',errors jsonb not null default '[]',requested_by_id text references public.users(id),created_at timestamptz not null default now());
create table public.unassigned_job_alerts(job_id text primary key references public.jobs(id) on delete cascade,alerted_at timestamptz not null default now());
alter table public.unassigned_job_alerts enable row level security;
create trigger settings_audit after update on public.company_settings for each row execute function public.audit_row_change();
create trigger pretrip_templates_audit after insert or update or delete on public.pretrip_templates for each row execute function public.audit_row_change();
create trigger sop_documents_audit after insert or update or delete on public.sop_documents for each row execute function public.audit_row_change();

alter table public.invoices enable row level security; alter table public.message_channels enable row level security; alter table public.message_channel_members enable row level security; alter table public.messages enable row level security; alter table public.message_reads enable row level security; alter table public.pretrip_templates enable row level security; alter table public.pretrip_submissions enable row level security; alter table public.sop_documents enable row level security; alter table public.sop_acknowledgements enable row level security; alter table public.company_settings enable row level security; alter table public.export_audit enable row level security; alter table public.import_runs enable row level security;

create policy invoices_read on public.invoices for select to authenticated using(public.has_permission('invoices'));
create policy invoices_write on public.invoices for all to authenticated using(public.has_permission('invoices')) with check(public.has_permission('invoices'));
create policy channels_read on public.message_channels for select to authenticated using(public.has_permission('messages') and (kind in('channel','announcement') or exists(select 1 from public.message_channel_members m where m.channel_id=id and m.user_id=public.current_app_user_id())));
create policy channel_members_read on public.message_channel_members for select to authenticated using(user_id=public.current_app_user_id() or public.admin_mfa_verified());
create policy messages_read on public.messages for select to authenticated using(exists(select 1 from public.message_channels c where c.id=channel_id));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=public.current_app_user_id() and public.has_permission('messages') and exists(select 1 from public.message_channels c where c.id=channel_id and (c.kind='channel' or (c.kind='announcement' and public.admin_mfa_verified()) or (c.kind='direct' and exists(select 1 from public.message_channel_members m where m.channel_id=c.id and m.user_id=public.current_app_user_id())))));
create policy message_reads_own on public.message_reads for all to authenticated using(user_id=public.current_app_user_id()) with check(user_id=public.current_app_user_id());
create policy channels_admin on public.message_channels for all to authenticated using(public.admin_mfa_verified()) with check(public.admin_mfa_verified());
create policy channel_members_admin on public.message_channel_members for all to authenticated using(public.admin_mfa_verified()) with check(public.admin_mfa_verified());
create policy pretrip_templates_read on public.pretrip_templates for select to authenticated using(public.current_app_user_id() is not null and (is_published or public.admin_mfa_verified()));
create policy pretrip_submissions_read on public.pretrip_submissions for select to authenticated using(driver_id=public.current_app_user_id() or public.current_access_role()='dispatcher' or public.admin_mfa_verified());
create policy pretrip_submissions_insert on public.pretrip_submissions for insert to authenticated with check(driver_id=public.current_app_user_id() and public.has_permission('pre_trip'));
create policy sops_read on public.sop_documents for select to authenticated using(public.current_app_user_id() is not null and (is_published or public.admin_mfa_verified()));
create policy sop_ack_own on public.sop_acknowledgements for all to authenticated using(user_id=public.current_app_user_id() or public.admin_mfa_verified()) with check(user_id=public.current_app_user_id());
create policy settings_read on public.company_settings for select to authenticated using(public.current_app_user_id() is not null);
create policy exports_read on public.export_audit for select to authenticated using(public.admin_mfa_verified());
create policy exports_insert on public.export_audit for insert to authenticated with check(public.has_permission('reports') and requested_by_id=public.current_app_user_id());
create policy imports_admin on public.import_runs for all to authenticated using(public.admin_mfa_verified()) with check(public.admin_mfa_verified());

create function public.save_company_settings(
  company_name text,
  company_address text,
  company_phone text,
  company_email text,
  company_time_zone text,
  company_date_format text,
  retention_days integer,
  invoice_prefix text
) returns public.company_settings language plpgsql security definer set search_path='' as $$
declare changed public.company_settings;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  if length(trim(coalesce(company_name,''))) < 2 then raise exception 'Company name is required'; end if;
  if nullif(trim(coalesce(company_email,'')),'') is not null and trim(company_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid company email'; end if;
  if company_time_zone <> 'America/Los_Angeles' then raise exception 'Unsupported time zone'; end if;
  if company_date_format not in('MM/DD/YYYY','DD/MM/YYYY') then raise exception 'Unsupported date format'; end if;
  if retention_days < 30 or retention_days > 3650 then raise exception 'Message retention must be between 30 and 3650 days'; end if;
  if upper(trim(coalesce(invoice_prefix,''))) !~ '^[A-Z0-9]{2,12}$' then raise exception 'Invoice prefix must be 2 to 12 letters or numbers'; end if;
  update public.company_settings set
    company_name=trim(company_name),
    address=trim(coalesce(company_address,'')),
    phone=trim(coalesce(company_phone,'')),
    email=lower(trim(coalesce(company_email,''))),
    time_zone=company_time_zone,
    date_format=company_date_format,
    message_retention_days=retention_days,
    invoice_prefix=upper(trim(invoice_prefix)),
    updated_at=now()
  where id=true returning * into changed;
  if changed.id is null then raise exception 'Company settings row is missing'; end if;
  return changed;
end;
$$;
revoke all on function public.save_company_settings(text,text,text,text,text,text,integer,text) from public,anon;
grant execute on function public.save_company_settings(text,text,text,text,text,text,integer,text) to authenticated;

create function public.publish_sop_document(sop_title text,sop_category text,sop_body text,required_for_drivers boolean default true)
returns public.sop_documents language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); next_version integer; created public.sop_documents;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  if length(trim(coalesce(sop_title,''))) < 2 then raise exception 'SOP title is required'; end if;
  if length(trim(coalesce(sop_body,''))) < 10 then raise exception 'SOP content is too short'; end if;
  lock table public.sop_documents in exclusive mode;
  select coalesce(max(version),0)+1 into next_version from public.sop_documents where title=trim(sop_title);
  insert into public.sop_documents(title,category,version,body,is_published,required_for_drivers,created_by_id)
  values(trim(sop_title),trim(coalesce(nullif(sop_category,''),'Procedure')),next_version,trim(sop_body),true,coalesce(required_for_drivers,true),actor)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.publish_sop_document(text,text,text,boolean) from public,anon;
grant execute on function public.publish_sop_document(text,text,text,boolean) to authenticated;

create function public.publish_pretrip_template(template_title text,item_labels text[])
returns public.pretrip_templates language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); next_version integer; created public.pretrip_templates; cleaned text[];
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  select array_agg(trim(label)) into cleaned from unnest(coalesce(item_labels,array[]::text[])) as items(label) where length(trim(label)) > 0;
  if length(trim(coalesce(template_title,''))) < 2 then raise exception 'Checklist title is required'; end if;
  if coalesce(array_length(cleaned,1),0) = 0 then raise exception 'At least one checklist item is required'; end if;
  if array_length(cleaned,1) > 80 then raise exception 'Checklist cannot exceed 80 items'; end if;
  lock table public.pretrip_templates in exclusive mode;
  select coalesce(max(version),0)+1 into next_version from public.pretrip_templates where title=trim(template_title);
  insert into public.pretrip_templates(title,version,is_published,items,created_by_id)
  values(trim(template_title),next_version,true,(select jsonb_agg(jsonb_build_object('id','item-'||ordinality,'label',label) order by ordinality) from unnest(cleaned) with ordinality as items(label,ordinality)),actor)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.publish_pretrip_template(text,text[]) from public,anon;
grant execute on function public.publish_pretrip_template(text,text[]) to authenticated;

create function public.list_message_recipients()
returns table(id text,full_name text) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_permission('messages') then return; end if;
  return query select u.id,u.full_name from public.users u where u.status='active' and u.deleted_at is null and u.id<>public.current_app_user_id() order by u.full_name;
end;
$$;
create function public.list_message_channels()
returns table(id text,name text,kind text,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_permission('messages') then return; end if;
  return query select c.id,
    case when c.kind='direct' then coalesce((select u.full_name from public.message_channel_members m join public.users u on u.id=m.user_id where m.channel_id=c.id and m.user_id<>public.current_app_user_id() limit 1),c.name) else c.name end,
    c.kind,c.created_at
  from public.message_channels c
  where c.kind in('channel','announcement') or exists(select 1 from public.message_channel_members m where m.channel_id=c.id and m.user_id=public.current_app_user_id())
  order by c.name;
end;
$$;
create function public.create_direct_message_channel(other_user_id text)
returns text language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); target public.users; result text;
begin
  if not public.has_permission('messages') then raise exception 'Messages permission required'; end if;
  if actor is null or actor=other_user_id then raise exception 'Choose another active employee'; end if;
  select * into target from public.users where id=other_user_id and status='active' and deleted_at is null;
  if target.id is null then raise exception 'Employee is unavailable'; end if;
  select c.id into result from public.message_channels c
    where c.kind='direct'
      and exists(select 1 from public.message_channel_members m where m.channel_id=c.id and m.user_id=actor)
      and exists(select 1 from public.message_channel_members m where m.channel_id=c.id and m.user_id=other_user_id)
      and (select count(*) from public.message_channel_members m where m.channel_id=c.id)=2 limit 1;
  if result is null then
    insert into public.message_channels(name,kind,created_by_id) values(target.full_name,'direct',actor) returning id into result;
    insert into public.message_channel_members(channel_id,user_id) values(result,actor),(result,other_user_id);
    perform public.write_audit('message_channels',result,'create_direct',null,jsonb_build_object('member_ids',array[actor,other_user_id]),null);
  end if;
  return result;
end;
$$;
grant execute on function public.list_message_recipients() to authenticated;
grant execute on function public.list_message_channels() to authenticated;
grant execute on function public.create_direct_message_channel(text) to authenticated;

create function public.apply_operations_import(payload jsonb,source_name text,source_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; actor text:=public.current_app_user_id(); counts jsonb; prior public.import_runs;
begin
  if auth.role()<>'service_role' and not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  select * into prior from public.import_runs where import_runs.source_hash=apply_operations_import.source_hash;
  if prior.id is not null then return jsonb_build_object('importRunId',prior.id,'status',prior.status,'counts',prior.counts,'idempotent',true); end if;
  for item in select * from jsonb_array_elements(coalesce(payload->'users','[]')) loop
    insert into public.users(id,employee_id,full_name,email,phone,role,access_role,status,initials,permission_overrides,pto_balance_hours,weekly_hours)
    values(item->>'id',item->>'employeeId',item->>'fullName',lower(item->>'email'),coalesce(item->>'phone',''),(item->>'role')::public.user_role,(item->>'accessRole')::public.access_role,coalesce((item->>'status')::public.employee_status,'active'),upper(left(regexp_replace(item->>'fullName','[^A-Za-z]','','g'),2)),'{}',nullif(item->>'ptoBalanceHours','')::numeric,nullif(item->>'weeklyHours','')::numeric)
    on conflict(id) do update set employee_id=excluded.employee_id,full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,role=excluded.role,access_role=excluded.access_role,status=excluded.status;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'customers','[]')) loop
    insert into public.customers(id,name,phone,email,address,customer_group,is_active) values(item->>'id',item->>'name',coalesce(item->>'phone',''),coalesce(item->>'email',''),item->>'address',nullif(item->>'group',''),true)
    on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,address=excluded.address,customer_group=excluded.customer_group,is_active=true,deleted_at=null;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'trucks','[]')) loop
    insert into public.trucks(id,number,type,status,license_plate,mileage,assigned_driver_id,notes,air_tag_id,last_known_location,last_seen_at) values(item->>'id',item->>'number',coalesce(item->>'type','Roll-off Truck'),coalesce((item->>'status')::public.truck_status,'in_use'),coalesce(item->>'licensePlate',''),coalesce((item->>'mileage')::integer,0),nullif(item->>'assignedDriverId',''),coalesce(item->>'notes',''),nullif(item->>'airTagId',''),nullif(item->>'lastKnownLocation',''),case when item?'lastKnownLocation' then now() else null end)
    on conflict(id) do update set number=excluded.number,type=excluded.type,status=excluded.status,license_plate=excluded.license_plate,mileage=excluded.mileage,assigned_driver_id=excluded.assigned_driver_id,notes=excluded.notes,air_tag_id=excluded.air_tag_id,last_known_location=excluded.last_known_location;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'dumpsters','[]')) loop
    insert into public.dumpsters(id,code,size,status,type,current_location,air_tag_id,notes) values(item->>'id',item->>'code',item->>'size',coalesce((item->>'status')::public.dumpster_status,'in_yard'),coalesce(item->>'type','Roll-off'),coalesce(item->>'currentLocation','Yard'),nullif(item->>'airTagId',''),coalesce(item->>'notes',''))
    on conflict(id) do update set code=excluded.code,size=excluded.size,status=excluded.status,type=excluded.type,current_location=excluded.current_location,air_tag_id=excluded.air_tag_id,notes=excluded.notes;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(payload->'jobs','[]')) loop
    insert into public.jobs(id,reference,customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,status,notes,traffic_instructions,created_by_id)
    values(item->>'id',item->>'reference',item->>'customerId',item->>'address',coalesce(item->>'phone',''),item->>'serviceType',item->>'dumpsterSize',nullif(item->>'assignedDriverId',''),nullif(item->>'assignedTruckId',''),nullif(item->>'assignedDumpsterId',''),(item->>'scheduledFor')::timestamptz,coalesce((item->>'status')::public.job_status,'pending'),coalesce(item->>'notes',''),nullif(item->>'trafficInstructions',''),actor)
    on conflict(id) do nothing;
    insert into public.job_events(job_id,event_type,occurred_at) values(item->>'id','created',now()),(item->>'id','assigned',case when nullif(item->>'assignedDriverId','') is null then null else now() end),(item->>'id','en_route',null),(item->>'id','arrived',null),(item->>'id','completed',null) on conflict do nothing;
  end loop;
  counts:=jsonb_build_object('users',jsonb_array_length(coalesce(payload->'users','[]')),'customers',jsonb_array_length(coalesce(payload->'customers','[]')),'trucks',jsonb_array_length(coalesce(payload->'trucks','[]')),'dumpsters',jsonb_array_length(coalesce(payload->'dumpsters','[]')),'jobs',jsonb_array_length(coalesce(payload->'jobs','[]')));
  insert into public.import_runs(source_name,source_hash,status,counts,requested_by_id) values(source_name,source_hash,'applied',counts,actor) returning id into source_name;
  return jsonb_build_object('importRunId',source_name,'status','applied','counts',counts,'idempotent',false);
end;
$$;
grant execute on function public.apply_operations_import(jsonb,text,text) to authenticated,service_role;

create function public.run_scheduled_maintenance()
returns jsonb language plpgsql security definer set search_path='' as $$
declare alerts integer:=0; pruned integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  delete from public.unassigned_job_alerts a using public.jobs j where a.job_id=j.id and (j.assigned_driver_id is not null or j.status<>'pending' or j.deleted_at is not null);
  with candidates as(select j.* from public.jobs j left join public.unassigned_job_alerts a on a.job_id=j.id where j.status='pending' and j.assigned_driver_id is null and j.deleted_at is null and j.scheduled_for between now() and now()+interval '2 hours' and a.job_id is null), inserted as(insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id) select u.id,'dispatcher','dispatch_update','Unassigned job approaching',c.reference||' is scheduled within two hours and has no driver.',c.id from candidates c join public.users u on u.access_role in('admin','dispatcher') and u.status='active' and u.deleted_at is null returning related_job_id), marked as(insert into public.unassigned_job_alerts(job_id) select distinct related_job_id from inserted on conflict do nothing returning job_id) select count(*) into alerts from marked;
  delete from public.messages where created_at < now()-(select message_retention_days from public.company_settings where id=true)*interval '1 day'; get diagnostics pruned=row_count;
  return jsonb_build_object('unassignedJobsAlerted',alerts,'messagesPruned',pruned);
end;
$$;
grant execute on function public.run_scheduled_maintenance() to service_role;

create function public.stamp_invoice_status() returns trigger language plpgsql set search_path='' as $$ begin if new.status='sent' and (tg_op='INSERT' or old.status is distinct from new.status) then new.sent_at=coalesce(new.sent_at,now()); elsif new.status='paid' and (tg_op='INSERT' or old.status is distinct from new.status) then new.paid_at=coalesce(new.paid_at,now()); elsif new.status='closed' and (tg_op='INSERT' or old.status is distinct from new.status) then new.closed_at=coalesce(new.closed_at,now()); end if; return new; end; $$;
create trigger invoices_stamp_status before insert or update of status on public.invoices for each row execute function public.stamp_invoice_status();

-- Clear any pending-job reservations created by earlier schema versions.
update public.trucks t set current_job_id=null where exists(select 1 from public.jobs j where j.id=t.current_job_id and j.status='pending');
update public.dumpsters d set current_job_id=null,current_customer_id=null,status=case when status='in_shop' then status else 'in_yard' end,current_location=case when status='in_shop' then current_location else 'Yard' end where exists(select 1 from public.jobs j where j.id=d.current_job_id and j.status='pending');

alter publication supabase_realtime add table public.invoices;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.time_requests;
alter publication supabase_realtime add table public.absence_events;
alter publication supabase_realtime add table public.message_channels;
alter publication supabase_realtime add table public.message_channel_members;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reads;
alter publication supabase_realtime add table public.pretrip_templates;
alter publication supabase_realtime add table public.pretrip_submissions;
alter publication supabase_realtime add table public.sop_documents;
alter publication supabase_realtime add table public.sop_acknowledgements;
alter publication supabase_realtime add table public.company_settings;

-- New module permission defaults.
create or replace function public.has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  with profile as(select access_role,permission_overrides from public.users where auth_user_id=auth.uid() and status='active' and deleted_at is null limit 1),
  defaults as(select access_role,case when access_role='dispatcher' then permission_key=any(array['dashboard','jobs','customers','trucks','dumpsters','time_clock','absence','messages','map','reports']) when access_role='driver' then permission_key=any(array['driver_jobs','time_clock','messages','pre_trip','sops','profile']) else false end allowed,permission_overrides from profile)
  select case when access_role='admin' then public.admin_mfa_verified() and coalesce((permission_overrides->>permission_key)::boolean,true) else coalesce((permission_overrides->>permission_key)::boolean,allowed,false) end from defaults
$$;

-- Fail closed by default for function execution, then grant intentional RPCs.
revoke all on function public.reserve_job_assets(public.jobs) from public,anon,authenticated;
revoke all on function public.release_job_assets(public.jobs) from public,anon,authenticated;
revoke all on function public.assert_active_user(text,public.access_role) from public,anon,authenticated;
revoke all on function public.notify_pretrip_failure() from public,anon,authenticated;
revoke all on function public.admin_mfa_verified() from public,anon;
grant execute on function public.admin_mfa_verified() to authenticated;
revoke all on function public.retire_prior_sop_versions() from public,anon,authenticated;
revoke all on function public.stamp_invoice_status() from public,anon,authenticated;
revoke all on function public.preserve_active_administrator() from public,anon,authenticated;
revoke all on function public.list_message_recipients() from public,anon;
revoke all on function public.list_message_channels() from public,anon;
revoke all on function public.create_direct_message_channel(text) from public,anon;
grant execute on function public.list_message_recipients() to authenticated;
grant execute on function public.list_message_channels() to authenticated;
grant execute on function public.create_direct_message_channel(text) to authenticated;
