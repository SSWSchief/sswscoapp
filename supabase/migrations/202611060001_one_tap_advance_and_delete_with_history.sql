-- Two changes Austin asked for on 2026-11-06.
--
-- 1. Office status updates are one tap. advance_job_as_dispatch no longer
--    requires a reason, and it no longer refuses when the assigned driver is
--    inactive or has not been given access yet ("Assigned employee is inactive
--    or missing"). The office is vouching for what happened; the driver's own
--    status is not the question. The activity log and audit record still say
--    the office made the change.
--
-- 2. Permanently deleting an employee who has job, time or other history now
--    succeeds. Their sign-in account is deleted and they disappear from the
--    employee list, but their profile row stays (marked removed, status
--    inactive) so every job, time entry and payroll record still shows who did
--    the work. Their email is released so the same person can be added again.
--    Employees with no history are still deleted outright, as before.

-- 1. ------------------------------------------------------------------------

drop function if exists public.reserve_job_assets(public.jobs);
create function public.reserve_job_assets(
  next_job public.jobs,
  office_override boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if next_job.status not in ('en_route','arrived') then return; end if;
  if not office_override then
    perform public.assert_active_user(next_job.assigned_driver_id, 'driver');
    if next_job.assigned_driver_id is null then raise exception 'Assign a driver before starting the job'; end if;
  end if;

  if next_job.assigned_truck_id is not null then
    perform 1 from public.trucks
      where id=next_job.assigned_truck_id and deleted_at is null and status='in_use'
        and (current_job_id is null or current_job_id=next_job.id) for update;
    if not found then raise exception 'Selected truck is active on another job or unavailable'; end if;
    update public.trucks set current_job_id=next_job.id, assigned_driver_id=next_job.assigned_driver_id,
      last_known_location=next_job.address, last_seen_at=now() where id=next_job.assigned_truck_id;
  end if;

  if next_job.assigned_dumpster_id is not null then
    perform 1 from public.dumpsters d
      where d.id=next_job.assigned_dumpster_id and d.deleted_at is null and d.status <> 'in_shop'
        and (d.current_job_id is null or d.current_job_id=next_job.id
          or not exists(
            select 1 from public.jobs held
            where held.id=d.current_job_id and held.status in ('en_route','arrived')
          ))
      for update of d;
    if not found then raise exception 'Selected dumpster is active on another job or unavailable'; end if;
    update public.dumpsters set current_job_id=next_job.id, current_customer_id=next_job.customer_id,
      current_location=next_job.address, status='out' where id=next_job.assigned_dumpster_id;
  end if;
end;
$$;
revoke all on function public.reserve_job_assets(public.jobs, boolean) from public, anon, authenticated;

drop function if exists public.advance_job_as_dispatch(text, public.job_status, text);
create function public.advance_job_as_dispatch(
  target_job_id text,
  next_status public.job_status,
  advance_reason text default null
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
  reason text := nullif(trim(coalesce(advance_reason, '')), '');
  previous public.jobs;
  changed public.jobs;
  steps public.job_status[] := array['en_route','arrived','complete']::public.job_status[];
  from_position int;
  to_position int;
  step public.job_status;
  idx int;
  event_name public.job_activity_type;
begin
  if not coalesce(public.has_permission('jobs'), false) then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status in ('complete','cancelled') then raise exception 'Only an open job can be advanced'; end if;
  to_position := array_position(steps, next_status);
  if to_position is null then raise exception 'Choose en route, arrived or complete'; end if;
  from_position := coalesce(array_position(steps, previous.status), 0);
  if to_position <= from_position then raise exception 'Choose a step after the current status'; end if;
  select full_name into actor from public.users where id = app_user_id;

  changed := previous;
  for idx in from_position + 1 .. to_position loop
    step := steps[idx];
    update public.jobs set status = step where id = target_job_id returning * into changed;
    event_name := (case when step = 'complete' then 'completed' else step::text end)::public.job_activity_type;
    insert into public.job_events(job_id, event_type, occurred_at) values (target_job_id, event_name, now())
      on conflict (job_id, event_type) do update set occurred_at = excluded.occurred_at;
    insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
      values (target_job_id, app_user_id, actor, event_name,
        'Office marked ' || replace(step::text, '_', ' ') || coalesce(': ' || reason, ''), true);
  end loop;

  if changed.status = 'complete' then
    perform public.release_job_assets(changed);
  else
    perform public.reserve_job_assets(changed, true);
  end if;
  perform public.write_audit('jobs', target_job_id, 'dispatcher_advance', to_jsonb(previous), to_jsonb(changed),
    coalesce(reason, 'Office status update'));
  return changed;
end;
$$;
revoke all on function public.advance_job_as_dispatch(text, public.job_status, text) from public, anon;
grant execute on function public.advance_job_as_dispatch(text, public.job_status, text) to authenticated, service_role;

-- 2. ------------------------------------------------------------------------

create or replace function public.permanently_delete_employee(
  target_user_id text,
  confirmation_email text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.current_app_user_id();
  employee public.users;
  reference record;
  has_history boolean := false;
  found_reference boolean;
begin
  if not public.admin_mfa_verified() then
    return jsonb_build_object('deleted', false, 'code', 'forbidden');
  end if;
  if target_user_id = actor then
    return jsonb_build_object('deleted', false, 'code', 'self_deletion');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('permanent-employee-deletion', 0));
  perform 1 from public.users where id in (actor, target_user_id) order by id for update;
  if not public.admin_mfa_verified() then
    return jsonb_build_object('deleted', false, 'code', 'forbidden');
  end if;
  select * into employee from public.users where id = target_user_id and deleted_at is null;
  if not found then
    return jsonb_build_object('deleted', false, 'code', 'employee_not_found');
  end if;
  if lower(trim(coalesce(confirmation_email, ''))) <> lower(employee.email) then
    return jsonb_build_object('deleted', false, 'code', 'confirmation_mismatch');
  end if;
  if exists(select 1 from public.protected_administrators
    where user_id = employee.id and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('deleted', false, 'code', 'administrator_protected');
  end if;
  if employee.access_role = 'admin' and employee.status = 'active'
    and (select count(*) from public.users
      where access_role = 'admin' and status = 'active' and deleted_at is null) <= 1 then
    return jsonb_build_object('deleted', false, 'code', 'last_admin');
  end if;

  -- Any business reference (job, time, payroll, message, ...) means the
  -- profile row must stay so those records keep their name.
  for reference in
    select c.conrelid, a.attname as column_name, b.attname as target_column,
      cardinality(c.conkey) as column_count
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute b on b.attrelid = c.confrelid and b.attnum = c.confkey[1]
    where c.contype = 'f' and c.confrelid = 'public.users'::regclass
      and n.nspname = 'public'
      and t.relname not in ('protected_administrators', 'notifications',
        'push_subscriptions', 'message_channel_members', 'message_reads')
  loop
    if reference.column_count <> 1 then
      has_history := true;
      exit;
    end if;
    execute format('select exists(select 1 from %s where %I::text = $1)',
      reference.conrelid::regclass, reference.column_name)
      into found_reference using to_jsonb(employee)->>reference.target_column;
    if found_reference then
      has_history := true;
      exit;
    end if;
  end loop;

  if not has_history and employee.auth_user_id is not null then
    has_history := exists(select 1 from storage.objects
      where owner_id = employee.auth_user_id::text or owner = employee.auth_user_id);
  end if;

  delete from public.protected_administrators
    where user_id = employee.id and expires_at <= now();

  if has_history then
    -- Keep the profile for the records; remove the person. The email is
    -- released so they can be added again later; the audit row keeps it.
    update public.users set
      status = 'inactive',
      deleted_at = now(),
      auth_user_id = null,
      email = 'removed-' || employee.id || '@deleted.invalid'
    where id = employee.id;
    delete from public.push_subscriptions where user_id = employee.id;
    delete from public.message_channel_members where user_id = employee.id;
  else
    delete from public.users where id = employee.id;
  end if;
  -- In the same transaction: if Auth cleanup fails, nothing above is kept.
  delete from auth.users where id = employee.auth_user_id;
  perform public.write_audit('users', employee.id, 'employee_permanently_deleted',
    jsonb_build_object('employee_id', employee.employee_id, 'full_name', employee.full_name,
      'email', employee.email, 'records_kept', has_history),
    null, 'Administrator confirmed permanent deletion');
  return jsonb_build_object('deleted', true, 'records_kept', has_history);
end;
$$;
revoke all on function public.permanently_delete_employee(text,text) from public, anon, service_role;
grant execute on function public.permanently_delete_employee(text,text) to authenticated;
