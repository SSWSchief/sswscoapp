-- A punch that was never made cannot be corrected, only added.
--
-- A driver who forgets to clock out has no way to fix it. `review_time_request`
-- required every approved edit_time request to name an existing entry, so the
-- only correction the app could express was "this punch was at the wrong
-- time" -- never "this punch never happened". The driver's recourse was to
-- text his hours to the owner, which is exactly what started happening.
--
-- Nothing else needs to move. `time_entry_corrections.original_entry_id` is
-- already nullable, and `applyTimeCorrections` already treats a correction
-- with no original as an addition rather than a replacement: it only removes
-- entries that a correction actually names. `summarizeDay` has always
-- surfaced the missed clock-out and refused to bill through it, on the
-- reasoning that payroll needs the gap corrected rather than silently paid.
-- This is the missing half of that: a way to correct it.
--
-- The control stays where it was. A null target is still an approval-gated,
-- audited request, still cannot be reviewed by the person who filed it, and
-- still records who approved it.

create or replace function public.review_time_request(request_id text, decision text)
returns public.time_requests language plpgsql security definer set search_path = '' as $$
declare reviewer text := public.current_app_user_id(); request public.time_requests; target public.time_entries;
begin
  if reviewer is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('time_clock') then raise exception 'Time clock review permission required'; end if;
  if decision not in ('approved','denied') then raise exception 'Decision must be approved or denied'; end if;

  select * into request from public.time_requests where id=request_id and status='pending' for update;
  if request.id is null then raise exception 'Pending request not found'; end if;

  if request.user_id = reviewer then
    raise exception 'You cannot review your own time request';
  end if;
  if request.kind='pto' and public.current_access_role() <> 'admin' then
    raise exception 'PTO is approved by management';
  end if;

  update public.time_requests set status=decision,reviewed_by_id=reviewer,reviewed_at=now()
  where id=request_id and status='pending' returning * into request;
  if request.id is null then raise exception 'Pending request not found'; end if;

  if decision='approved' and request.kind='edit_time' then
    if request.requested_entry_type is null or request.requested_at is null then raise exception 'Correction details are incomplete'; end if;
    -- A null target is deliberate and means "this punch was never made".
    -- Only a named target has to exist, and has to belong to the requester.
    if request.target_entry_id is not null then
      select * into target from public.time_entries where id = request.target_entry_id and user_id = request.user_id;
      if target.id is null then raise exception 'Target time entry was not found for this employee'; end if;
    end if;
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

comment on function public.review_time_request(text, text) is
  'Reviews a pending time request. Self-review is rejected for both kinds, and PTO requires administrator access (202608140001). An edit_time request with no target entry adds a punch that was never made (202609010003).';
