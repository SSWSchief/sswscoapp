-- A missed clock-out locked the driver out of the time clock for good.
--
-- record_time_event decided the legal next punch from the person's last punch
-- ever. The app decides it from today's punches (Las Vegas day), as payroll
-- does: summarizeDay leaves an unclosed day open for a correction instead of
-- billing it through. So once Matthew forgot to clock out on 2026-10-07, every
-- later day showed "Clocked Out" with a Clock In button, and every tap was
-- refused with "Invalid time event after clock_in". An approved correction did
-- not help either: corrections live in time_entry_corrections and this
-- function only ever read time_entries.
--
-- Judge the next punch from today's punches only, the same rule the app shows.
-- An earlier day left open stays open, flagged to management as a missed
-- clock-out and fixed through Fix My Hours, exactly as before.
create or replace function public.record_time_event(next_type public.time_entry_type)
returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  today_start timestamptz := date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  previous public.time_entry_type;
  created public.time_entries;
  allowed boolean := false;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not coalesce(public.has_permission('time_clock'), false) then raise exception 'Time clock permission required'; end if;
  perform pg_advisory_xact_lock(hashtext(app_user_id));
  select entry_type into previous from public.time_entries
  where user_id = app_user_id and occurred_at >= today_start
  order by occurred_at desc limit 1;
  allowed := (previous is null and next_type = 'clock_in') or (previous = 'clock_out' and next_type = 'clock_in')
    or (previous = 'clock_in' and next_type in ('break_start','clock_out'))
    or (previous = 'break_start' and next_type = 'break_end')
    or (previous = 'break_end' and next_type in ('break_start','clock_out'));
  if not allowed then raise exception 'Invalid time event after %', coalesce(previous::text, 'no prior event'); end if;
  insert into public.time_entries(user_id, entry_type, occurred_at) values (app_user_id, next_type, now()) returning * into created;
  perform public.write_audit('time_entries', created.id, 'create', null, to_jsonb(created), null);
  return created;
end;
$$;
