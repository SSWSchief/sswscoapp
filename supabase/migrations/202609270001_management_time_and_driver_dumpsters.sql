-- Management may correct a missed punch or record paid hours without inventing
-- clock events. Both operations retain the original record and the actor.

alter table public.time_requests
  add column submitted_by_id text references public.users(id) on delete set null;

alter table public.time_entry_corrections
  add column superseded_at timestamptz,
  add column superseded_by_id text references public.users(id);
create index time_corrections_active_user_idx
  on public.time_entry_corrections(user_id, replacement_at)
  where superseded_at is null;
create trigger time_corrections_audit
  after insert or update on public.time_entry_corrections
  for each row execute function public.audit_row_change();

create table public.paid_time_adjustments (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete restrict,
  work_date date not null,
  paid_minutes integer not null check (paid_minutes between 1 and 1440),
  reason text not null check (length(trim(reason)) between 3 and 500),
  entered_by_id text not null references public.users(id) on delete restrict,
  revises_id text references public.paid_time_adjustments(id) on delete restrict,
  voided_at timestamptz,
  voided_by_id text references public.users(id) on delete restrict,
  void_reason text,
  created_at timestamptz not null default now()
);
create index paid_time_adjustments_user_date_idx
  on public.paid_time_adjustments(user_id, work_date);
alter table public.paid_time_adjustments enable row level security;
create policy paid_time_adjustments_read on public.paid_time_adjustments
  for select to authenticated using (
    user_id=public.current_app_user_id()
    or public.admin_mfa_verified()
    or (public.current_access_role()='dispatcher' and public.has_permission('time_clock'))
  );
revoke all on public.paid_time_adjustments from public, anon, authenticated;
grant select on public.paid_time_adjustments to authenticated;
create trigger paid_time_adjustments_audit
  after insert or update on public.paid_time_adjustments
  for each row execute function public.audit_row_change();

create function public.save_paid_time_adjustment(
  target_user_id text, target_date date, minutes integer,
  adjustment_reason text, previous_id text default null
) returns public.paid_time_adjustments language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); prior public.paid_time_adjustments; saved public.paid_time_adjustments;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if target_date is null or minutes is null or minutes not between 1 and 1440 then raise exception 'Paid minutes must be between 1 and 1440'; end if;
  if length(trim(coalesce(adjustment_reason,''))) not between 3 and 500 then raise exception 'A reason is required'; end if;
  if not exists(select 1 from public.users where id=target_user_id and role in ('driver','dispatcher','office') and status='active' and deleted_at is null) then
    raise exception 'Active hourly employee required';
  end if;
  if target_user_id=actor then raise exception 'You cannot adjust your own paid time'; end if;
  if previous_id is not null then
    select * into prior from public.paid_time_adjustments where id=previous_id and voided_at is null for update;
    if prior.id is null or prior.user_id<>target_user_id then raise exception 'Active adjustment not found for employee'; end if;
    update public.paid_time_adjustments set voided_at=now(),voided_by_id=actor,void_reason='Revised'
      where id=previous_id;
  end if;
  insert into public.paid_time_adjustments(user_id,work_date,paid_minutes,reason,entered_by_id,revises_id)
    values(target_user_id,target_date,minutes,trim(adjustment_reason),actor,previous_id)
    returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_paid_time_adjustment(text,date,integer,text,text) from public,anon;
grant execute on function public.save_paid_time_adjustment(text,date,integer,text,text) to authenticated;

create function public.void_paid_time_adjustment(target_id text, reversal_reason text)
returns public.paid_time_adjustments language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); saved public.paid_time_adjustments;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce(reversal_reason,''))) not between 3 and 500 then raise exception 'A reversal reason is required'; end if;
  if exists(select 1 from public.paid_time_adjustments where id=target_id and user_id=actor) then
    raise exception 'You cannot reverse your own paid time';
  end if;
  update public.paid_time_adjustments set voided_at=now(),voided_by_id=actor,void_reason=trim(reversal_reason)
    where id=target_id and voided_at is null returning * into saved;
  if saved.id is null then raise exception 'Active adjustment not found'; end if;
  return saved;
end;
$$;
revoke all on function public.void_paid_time_adjustment(text,text) from public,anon;
grant execute on function public.void_paid_time_adjustment(text,text) to authenticated;

create function public.manage_time_correction(
  target_user_id text, punch_type public.time_entry_type, punch_at timestamptz,
  correction_reason text, original_entry_id text default null,
  replaces_correction_id text default null
) returns public.time_entry_corrections language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); old_correction public.time_entry_corrections; request_id text; saved public.time_entry_corrections;
  target_day date:=(punch_at at time zone 'America/Los_Angeles')::date; original_day date;
  punch record; phase text:='out'; previous_at timestamptz;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if punch_type is null or punch_at is null then raise exception 'Punch type and time are required'; end if;
  if length(trim(coalesce(correction_reason,''))) not between 3 and 500 then raise exception 'A correction reason is required'; end if;
  if not exists(select 1 from public.users where id=target_user_id and role in ('driver','dispatcher','office') and status='active' and deleted_at is null) then
    raise exception 'Active hourly employee required';
  end if;
  if target_user_id=actor then raise exception 'You cannot correct your own punch'; end if;
  perform pg_advisory_xact_lock(hashtext(target_user_id));
  if replaces_correction_id is not null then
    select * into old_correction from public.time_entry_corrections
      where id=replaces_correction_id and user_id=target_user_id and superseded_at is null for update;
    if old_correction.id is null then raise exception 'Active correction not found'; end if;
    if (old_correction.replacement_at at time zone 'America/Los_Angeles')::date<>target_day then
      raise exception 'Choose the punch day when revising a correction';
    end if;
    if original_entry_id is not null and original_entry_id is distinct from old_correction.original_entry_id then
      raise exception 'Correction target does not match';
    end if;
    original_entry_id:=old_correction.original_entry_id;
    update public.time_entry_corrections set superseded_at=now(),superseded_by_id=actor
      where id=replaces_correction_id;
  end if;
  if original_entry_id is not null then
    select (occurred_at at time zone 'America/Los_Angeles')::date into original_day
      from public.time_entries where id=original_entry_id and user_id=target_user_id;
    if original_day is null then
      raise exception 'Original punch not found for employee';
    end if;
    if original_day<>target_day then raise exception 'Choose the original punch day'; end if;
    if exists(select 1 from public.time_entry_corrections c where c.original_entry_id=manage_time_correction.original_entry_id and c.superseded_at is null) then
      raise exception 'Punch already has an active correction';
    end if;
  end if;
  insert into public.time_requests(user_id,kind,status,requested_for,hours,reason,target_entry_id,requested_entry_type,requested_at,reviewed_by_id,reviewed_at,submitted_by_id)
    values(target_user_id,'edit_time','approved',(punch_at at time zone 'America/Los_Angeles')::date,0,trim(correction_reason),original_entry_id,punch_type,punch_at,actor,now(),actor)
    returning id into request_id;
  insert into public.time_entry_corrections(request_id,original_entry_id,user_id,replacement_type,replacement_at,reason,approved_by_id)
    values(request_id,original_entry_id,target_user_id,punch_type,punch_at,trim(correction_reason),actor)
    returning * into saved;
  -- Reject corrections that would be ignored by the time summarizer. An open
  -- shift or break at day-end is allowed; an impossible transition is not.
  for punch in
    select event_type,event_at from (
      select e.entry_type as event_type,e.occurred_at as event_at from public.time_entries e
        where e.user_id=target_user_id and (e.occurred_at at time zone 'America/Los_Angeles')::date=target_day
        and not exists(select 1 from public.time_entry_corrections c where c.original_entry_id=e.id and c.superseded_at is null)
      union all
      select c.replacement_type,c.replacement_at from public.time_entry_corrections c
        where c.user_id=target_user_id and c.superseded_at is null
          and (c.replacement_at at time zone 'America/Los_Angeles')::date=target_day
    ) effective order by event_at
  loop
    if previous_at=punch.event_at then raise exception 'Two punches cannot share a time'; end if;
    if phase='out' and punch.event_type='clock_in' then phase:='in';
    elsif phase='in' and punch.event_type='break_start' then phase:='break';
    elsif phase='in' and punch.event_type='clock_out' then phase:='out';
    elsif phase='break' and punch.event_type='break_end' then phase:='in';
    else raise exception 'Punch order is invalid for this day';
    end if;
    previous_at:=punch.event_at;
  end loop;
  return saved;
end;
$$;
revoke all on function public.manage_time_correction(text,public.time_entry_type,timestamptz,text,text,text) from public,anon;
grant execute on function public.manage_time_correction(text,public.time_entry_type,timestamptz,text,text,text) to authenticated;

-- Drivers need the inventory directory, while writes remain staff-only.
drop policy if exists dumpsters_read on public.dumpsters;
create policy dumpsters_read on public.dumpsters for select to authenticated using (
  public.has_permission('dumpsters') or (deleted_at is null and public.has_permission('driver_jobs'))
);
