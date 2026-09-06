-- Say why a punch was refused in words a driver can act on.
--
-- `record_time_event` refuses anything that does not follow the last punch,
-- which is right: it is what stops a double tap in the cab from opening a
-- second shift. What it said was "Invalid time event after clock_in", and that
-- sentence now reaches the driver unchanged — the browser passes through the
-- messages this schema raises deliberately, on the grounds that they were
-- written for people (see src/lib/mutation-errors.ts). This one was not.
--
-- The rule and the advisory lock are untouched; only the wording changes.

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
  if not allowed then
    raise exception 'That punch does not follow your last one (%). Reopen the time clock to see where you are.',
      case previous
        when 'clock_in' then 'clocked in'
        when 'break_start' then 'on break'
        when 'break_end' then 'back on the clock'
        when 'clock_out' then 'clocked out'
        else 'no punches yet today'
      end;
  end if;
  insert into public.time_entries(user_id,entry_type,occurred_at) values(app_user_id,next_type,now()) returning * into created;
  perform public.write_audit('time_entries',created.id,'create',null,to_jsonb(created),null);
  return created;
end;
$$;
