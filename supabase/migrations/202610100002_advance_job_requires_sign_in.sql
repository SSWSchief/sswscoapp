-- advance_job_as_dispatch must refuse a caller who is not signed in.
--
-- has_permission() returns NULL, not false, for someone with no profile, and
-- "if not NULL" does not raise, so an anonymous caller got past the permission
-- check (found when a call as the anon role reached "Job not found" instead of
-- "Jobs permission required"). Treat NULL as no, and take the function away
-- from anon: the app only ever calls it signed in.
create or replace function public.advance_job_as_dispatch(
  target_job_id text,
  next_status public.job_status,
  advance_reason text
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
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
  if length(trim(coalesce(advance_reason,''))) < 3 then raise exception 'A reason is required'; end if;
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
        'Dispatch marked ' || replace(step::text, '_', ' ') || ': ' || trim(advance_reason), true);
  end loop;

  if changed.status = 'complete' then
    perform public.release_job_assets(changed);
  elsif changed.assigned_driver_id is not null then
    perform public.reserve_job_assets(changed);
  end if;
  perform public.write_audit('jobs', target_job_id, 'dispatcher_advance', to_jsonb(previous), to_jsonb(changed), advance_reason);
  return changed;
end;
$$;


revoke all on function public.advance_job_as_dispatch(text, public.job_status, text) from public, anon;
grant execute on function public.advance_job_as_dispatch(text, public.job_status, text) to authenticated, service_role;
