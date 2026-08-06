create or replace function public.record_time_event(next_type public.time_entry_type)
returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  previous public.time_entry_type;
  created public.time_entries;
  expected public.time_entry_type;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.users where id=app_user_id and status='active') then raise exception 'Inactive account'; end if;
  select entry_type into previous from public.time_entries where user_id=app_user_id and (occurred_at at time zone 'America/Los_Angeles')::date=(now() at time zone 'America/Los_Angeles')::date order by occurred_at desc limit 1;
  expected := (case when previous is null or previous='clock_out' then 'clock_in' when previous='clock_in' then 'break_start' when previous='break_start' then 'break_end' when previous='break_end' then 'clock_out' end)::public.time_entry_type;
  if next_type is distinct from expected then raise exception 'Invalid time event: expected %, received %',expected,next_type; end if;
  insert into public.time_entries(user_id,entry_type,occurred_at) values(app_user_id,next_type,now()) returning * into created;
  perform public.write_audit('time_entry',created.id,'created',null,to_jsonb(created),null);
  return created;
end $$;
