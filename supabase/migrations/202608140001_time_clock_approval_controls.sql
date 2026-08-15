-- Approval controls for the time clock.
--
-- Dispatch and office staff now clock in alongside drivers, which turns two
-- previously theoretical gaps in `review_time_request` into live ones: the
-- function never compared the reviewer to the requester, and it accepted any
-- holder of the `time_clock` permission as a PTO approver. A dispatcher could
-- therefore approve their own time off the moment they had a timesheet.
--
-- Two rules, enforced here because the database is the real boundary; the
-- dispatch UI hides the buttons to match but is not what makes it true.
--   1. Nobody reviews their own request, of either kind. A dispatcher editing
--      their own clock-in is the same conflict as approving their own PTO.
--   2. PTO is approved by management (administrator access) only.
--
-- The pending row is also locked before the decision is written, so two
-- reviewers acting at once cannot both record an approval.

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

comment on function public.review_time_request(text, text) is
  'Reviews a pending time request. Self-review is rejected for both kinds, and PTO requires administrator access; see 202608140001.';
