-- Close the highest-risk role workflow gaps found in the end-to-end pilot audit.
-- This migration keeps operational state transactional at the database boundary.

create or replace function public.has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  with profile as (
    select access_role, permission_overrides
    from public.users
    where auth_user_id = auth.uid() and status = 'active' and deleted_at is null
    limit 1
  ),
  defaults as (
    select case
      when access_role = 'admin' then true
      when access_role = 'dispatcher' then permission_key = any(array[
        'dashboard','jobs','customers','trucks','dumpsters','time_clock','absence','messages','map','reports'
      ])
      when access_role = 'driver' then permission_key = any(array[
        'driver_jobs','time_clock','messages','pre_trip','sops','profile'
      ])
      else false
    end as allowed,
    permission_overrides
    from profile
  )
  select coalesce((permission_overrides ->> permission_key)::boolean, allowed, false)
  from defaults
$$;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.current_app_user_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.users where auth_user_id = auth.uid() and status = 'active' and deleted_at is null limit 1
$$;

create or replace function public.current_access_role() returns public.access_role
language sql stable security definer set search_path = '' as $$
  select access_role from public.users where auth_user_id = auth.uid() and status = 'active' and deleted_at is null limit 1
$$;

drop policy if exists customers_read on public.customers;
drop policy if exists trucks_read on public.trucks;
drop policy if exists dumpsters_read on public.dumpsters;

create policy customers_read on public.customers for select to authenticated using (
  public.has_permission('customers')
  or exists (
    select 1 from public.jobs j
    where j.customer_id = customers.id
      and j.assigned_driver_id = public.current_app_user_id()
      and j.deleted_at is null
  )
);

create policy trucks_read on public.trucks for select to authenticated using (
  public.has_permission('trucks')
  or exists (
    select 1 from public.jobs j
    where j.assigned_truck_id = trucks.id
      and j.assigned_driver_id = public.current_app_user_id()
      and j.deleted_at is null
  )
);

create policy dumpsters_read on public.dumpsters for select to authenticated using (
  public.has_permission('dumpsters')
  or exists (
    select 1 from public.jobs j
    where j.assigned_dumpster_id = dumpsters.id
      and j.assigned_driver_id = public.current_app_user_id()
      and j.deleted_at is null
  )
);

create or replace function public.assert_active_user(target_user_id text, required_role public.access_role default null)
returns void language plpgsql stable security definer set search_path = '' as $$
declare profile public.users;
begin
  if target_user_id is null then
    return;
  end if;
  select * into profile from public.users where id = target_user_id and status = 'active' and deleted_at is null;
  if profile.id is null then
    raise exception 'Assigned employee is inactive or missing';
  end if;
  if required_role is not null and profile.access_role <> required_role then
    raise exception 'Assigned employee must have % access', required_role;
  end if;
end;
$$;

create or replace function public.release_job_assets(previous_job public.jobs)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if previous_job.assigned_truck_id is not null then
    update public.trucks
    set current_job_id = null,
        last_seen_at = now()
    where id = previous_job.assigned_truck_id and current_job_id = previous_job.id;
  end if;

  if previous_job.assigned_dumpster_id is not null then
    update public.dumpsters
    set current_job_id = null,
        current_customer_id = null,
        current_location = 'Yard',
        status = case when status = 'in_shop' then status else 'in_yard' end
    where id = previous_job.assigned_dumpster_id and current_job_id = previous_job.id;
  end if;
end;
$$;

create or replace function public.reserve_job_assets(next_job public.jobs)
returns void language plpgsql security definer set search_path = '' as $$
declare blocking_reference text;
begin
  if next_job.assigned_driver_id is not null then
    perform public.assert_active_user(next_job.assigned_driver_id, 'driver');
  end if;

  if next_job.assigned_truck_id is not null then
    select j.reference into blocking_reference
    from public.trucks t
    left join public.jobs j on j.id = t.current_job_id
    where t.id = next_job.assigned_truck_id
      and t.deleted_at is null
      and t.status <> 'down'
      and t.status <> 'in_shop'
      and (t.current_job_id is null or t.current_job_id = next_job.id)
    for update;

    if not found then
      raise exception 'Selected truck is unavailable';
    end if;

    update public.trucks
    set current_job_id = next_job.id,
        assigned_driver_id = next_job.assigned_driver_id,
        last_known_location = next_job.address,
        last_seen_at = now()
    where id = next_job.assigned_truck_id;
  end if;

  if next_job.assigned_dumpster_id is not null then
    select j.reference into blocking_reference
    from public.dumpsters d
    left join public.jobs j on j.id = d.current_job_id
    where d.id = next_job.assigned_dumpster_id
      and d.deleted_at is null
      and d.status <> 'in_shop'
      and (d.current_job_id is null or d.current_job_id = next_job.id)
    for update;

    if not found then
      raise exception 'Selected dumpster is unavailable';
    end if;

    update public.dumpsters
    set current_job_id = next_job.id,
        current_customer_id = next_job.customer_id,
        current_location = next_job.address,
        status = 'out'
    where id = next_job.assigned_dumpster_id;
  end if;
end;
$$;

create or replace function public.create_job(
  customer_id text,
  job_address text,
  job_phone text,
  service text,
  container_size text,
  driver_id text,
  truck_id text,
  dumpster_id text,
  schedule_at timestamptz,
  job_notes text default '',
  traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; created public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if not exists (select 1 from public.customers where id = customer_id and is_active and deleted_at is null) then
    raise exception 'Active customer is required';
  end if;
  perform public.assert_active_user(driver_id, 'driver');
  select full_name into actor_name from public.users where id = actor_id;
  insert into public.jobs(customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,notes,traffic_instructions,created_by_id)
  values (customer_id,job_address,job_phone,service,container_size,driver_id,truck_id,dumpster_id,schedule_at,coalesce(job_notes,''),nullif(traffic,''),actor_id)
  returning * into created;
  perform public.reserve_job_assets(created);
  insert into public.job_events(job_id,event_type,occurred_at) values
    (created.id,'created',now()),(created.id,'assigned',now()),(created.id,'en_route',null),(created.id,'arrived',null),(created.id,'completed',null);
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
  values (created.id,actor_id,actor_name,'created',created.reference || ' created and assigned.',true);
  if driver_id is not null then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
    values (driver_id,'dispatcher','job_assignment','New job assigned: ' || created.reference,service || ' at ' || job_address || '. Please acknowledge this assignment.',created.id);
  end if;
  return created;
end;
$$;

create or replace function public.edit_job(
  target_job_id text,
  customer_id text,
  job_address text,
  job_phone text,
  service text,
  container_size text,
  driver_id text,
  truck_id text,
  dumpster_id text,
  schedule_at timestamptz,
  job_notes text default '',
  traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status in ('complete','cancelled') then raise exception 'Completed or cancelled jobs cannot be edited'; end if;
  if not exists (select 1 from public.customers where id = customer_id and is_active and deleted_at is null) then
    raise exception 'Active customer is required';
  end if;
  perform public.assert_active_user(driver_id, 'driver');
  perform public.release_job_assets(previous);
  update public.jobs
  set customer_id = edit_job.customer_id,
      address = job_address,
      phone = job_phone,
      service_type = service,
      dumpster_size = container_size,
      assigned_driver_id = driver_id,
      assigned_truck_id = truck_id,
      assigned_dumpster_id = dumpster_id,
      scheduled_for = schedule_at,
      notes = coalesce(job_notes,''),
      traffic_instructions = nullif(traffic,'')
  where id = target_job_id
  returning * into changed;
  perform public.reserve_job_assets(changed);
  select full_name into actor_name from public.users where id = actor_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
  values (target_job_id,actor_id,actor_name,'assigned','Job details or assignments updated.',true);
  if driver_id is not null and driver_id is distinct from previous.assigned_driver_id then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
    values (driver_id,'dispatcher','job_assignment','Job assigned: ' || changed.reference,'You have been assigned ' || changed.reference || '.',target_job_id);
  end if;
  perform public.write_audit('jobs',target_job_id,'edit',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;
grant execute on function public.edit_job(text,text,text,text,text,text,text,text,text,timestamptz,text,text) to authenticated;

create or replace function public.assign_job(target_job_id text, driver_id text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  perform public.assert_active_user(driver_id, 'driver');
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status in ('complete','cancelled') then raise exception 'Completed or cancelled jobs cannot be reassigned'; end if;
  update public.jobs set assigned_driver_id = driver_id where id = target_job_id returning * into changed;
  perform public.reserve_job_assets(changed);
  select full_name into actor_name from public.users where id = actor_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
  values (target_job_id,actor_id,actor_name,'assigned','Driver assignment updated.',true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
  values (driver_id,'dispatcher','job_assignment','Job assigned: ' || changed.reference,'You have been assigned ' || changed.reference || '.',target_job_id);
  perform public.write_audit('jobs',target_job_id,'assign_driver',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;

create or replace function public.cancel_job(target_job_id text, cancel_reason text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if length(trim(coalesce(cancel_reason,''))) < 3 then raise exception 'Cancellation reason is required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  update public.jobs set status = 'cancelled', cancellation_reason = trim(cancel_reason)
  where id = target_job_id and deleted_at is null returning * into changed;
  perform public.release_job_assets(changed);
  perform public.write_audit('jobs',target_job_id,'cancel',to_jsonb(previous),to_jsonb(changed),cancel_reason);
  return changed;
end;
$$;

create or replace function public.update_assigned_job_status(target_job_id text, next_status public.job_status)
returns void language plpgsql security definer set search_path = '' as $$
declare app_user_id text := public.current_app_user_id(); actor text; event_name public.job_activity_type; target public.jobs; changed public.jobs;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  select * into target from public.jobs where id = target_job_id and deleted_at is null for update;
  if target.id is null then raise exception 'Job not found'; end if;
  if not public.has_permission('jobs') and target.assigned_driver_id <> app_user_id then raise exception 'Job is not assigned to this user'; end if;
  if next_status not in ('en_route','arrived','complete') then raise exception 'Unsupported driver status'; end if;
  if next_status = 'complete' and not exists (select 1 from public.job_photos where job_id = target_job_id) then raise exception 'At least one completion photo is required'; end if;
  select full_name into actor from public.users where id = app_user_id;
  event_name := case when next_status = 'complete' then 'completed'::public.job_activity_type else next_status::text::public.job_activity_type end;
  update public.jobs set status = next_status where id = target_job_id returning * into changed;
  if next_status = 'complete' then
    perform public.release_job_assets(changed);
  else
    perform public.reserve_job_assets(changed);
  end if;
  insert into public.job_events(job_id,event_type,occurred_at) values (target_job_id,event_name,now()) on conflict (job_id,event_type) do update set occurred_at=excluded.occurred_at;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values (target_job_id,app_user_id,actor,event_name,case when next_status='complete' then 'Job completed' else 'Driver marked '||replace(next_status::text,'_',' ') end,true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
  select u.id,'driver','driver_status',actor||': '||target.reference,'Job status changed to '||replace(next_status::text,'_',' '),target.id from public.users u where u.access_role in ('admin','dispatcher') and u.status='active' and u.deleted_at is null;
end;
$$;

create or replace function public.complete_job_as_dispatch(target_job_id text, override_reason text default null)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare previous public.jobs; changed public.jobs; has_photo boolean;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  select exists(select 1 from public.job_photos where job_id=target_job_id) into has_photo;
  if not has_photo and length(trim(coalesce(override_reason,''))) < 3 then raise exception 'An override reason is required when no photo exists'; end if;
  update public.jobs set status='complete' where id=target_job_id and status='arrived' and deleted_at is null returning * into changed;
  if changed.id is null then raise exception 'Only an arrived job can be completed'; end if;
  perform public.release_job_assets(changed);
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,'completed',now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  perform public.write_audit('jobs',target_job_id,'dispatcher_complete',to_jsonb(previous),to_jsonb(changed),override_reason);
  return changed;
end;
$$;

create or replace function public.log_assigned_job_dry_run(target_job_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('jobs') and not exists (
    select 1 from public.jobs where id = target_job_id and assigned_driver_id = app_user_id and deleted_at is null
  ) then raise exception 'Job is not assigned to this user'; end if;
  select full_name into actor from public.users where id = app_user_id;
  insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
    values (target_job_id, app_user_id, actor, 'dry_run', 'Dry run logged from driver portal', true);
  insert into public.notifications(recipient_user_id, source_role, category, title, body, related_job_id)
    select u.id, 'driver', 'dry_run', actor || ': ' || j.reference, 'Dry run logged. Dispatch acknowledgement requested.', j.id
    from public.jobs j
    join public.users u on u.access_role in ('admin', 'dispatcher') and u.status = 'active' and u.deleted_at is null
    where j.id = target_job_id;
end;
$$;

create or replace function public.review_time_request(request_id text, decision text)
returns public.time_requests language plpgsql security definer set search_path = '' as $$
declare reviewer text := public.current_app_user_id(); request public.time_requests; target public.time_entries;
begin
  if not public.has_permission('time_clock') then raise exception 'Time clock review permission required'; end if;
  if decision not in ('approved','denied') then raise exception 'Decision must be approved or denied'; end if;
  update public.time_requests set status=decision,reviewed_by_id=reviewer,reviewed_at=now()
  where id=request_id and status='pending' returning * into request;
  if request.id is null then raise exception 'Pending request not found'; end if;
  if decision='approved' and request.kind='edit_time' then
    if request.requested_entry_type is null or request.requested_at is null or request.target_entry_id is null then raise exception 'Correction details are incomplete'; end if;
    select * into target from public.time_entries where id = request.target_entry_id and user_id = request.user_id;
    if target.id is null then raise exception 'Target time entry was not found for this employee'; end if;
    insert into public.time_entry_corrections(request_id,original_entry_id,user_id,replacement_type,replacement_at,reason,approved_by_id)
    values(request.id,request.target_entry_id,request.user_id,request.requested_entry_type,request.requested_at,request.reason,reviewer);
  elsif decision='approved' and request.kind='pto' then
    if request.hours <= 0 then raise exception 'PTO hours must be greater than zero'; end if;
    insert into public.absence_events(user_id,event_date,absence_type,status,note)
    values(request.user_id,request.requested_for,'pto','approved',request.reason);
  end if;
  perform public.write_audit('time_requests',request.id,'review',null,to_jsonb(request),decision);
  return request;
end;
$$;

