-- Production hardening: transactional operations, audit history, soft deletion,
-- strict time sequencing, and correction/PTO review.

alter table public.users add column if not exists deleted_at timestamptz;
alter table public.customers add column if not exists is_active boolean not null default true;
alter table public.customers add column if not exists deleted_at timestamptz;
alter table public.trucks add column if not exists deleted_at timestamptz;
alter table public.dumpsters add column if not exists deleted_at timestamptz;
alter table public.jobs add column if not exists deleted_at timestamptz;
alter table public.jobs add column if not exists cancellation_reason text;
alter table public.time_requests add column if not exists target_entry_id text references public.time_entries(id) on delete set null;
alter table public.time_requests add column if not exists requested_entry_type public.time_entry_type;
alter table public.time_requests add column if not exists requested_at timestamptz;
alter table public.time_requests add column if not exists reviewed_by_id text references public.users(id) on delete set null;
alter table public.time_requests add column if not exists reviewed_at timestamptz;

create table public.time_entry_corrections (
  id text primary key default gen_random_uuid()::text,
  request_id text not null unique references public.time_requests(id) on delete cascade,
  original_entry_id text references public.time_entries(id) on delete set null,
  user_id text not null references public.users(id) on delete cascade,
  replacement_type public.time_entry_type not null,
  replacement_at timestamptz not null,
  reason text not null,
  approved_by_id text not null references public.users(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id text references public.users(id) on delete set null,
  entity_table text not null,
  entity_id text not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log(entity_table, entity_id, created_at desc);
create index time_corrections_user_idx on public.time_entry_corrections(user_id, replacement_at desc);

alter table public.time_entry_corrections enable row level security;
alter table public.audit_log enable row level security;

create policy time_corrections_read on public.time_entry_corrections for select to authenticated
using (public.is_staff() or user_id = public.current_app_user_id());
create policy audit_staff_read on public.audit_log for select to authenticated
using (public.is_staff());

create or replace function public.write_audit(
  target_table text,
  target_id text,
  audit_action text,
  previous_values jsonb default null,
  resulting_values jsonb default null,
  audit_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log(actor_id, entity_table, entity_id, action, old_values, new_values, reason)
  values (public.current_app_user_id(), target_table, target_id, audit_action, previous_values, resulting_values, audit_reason);
end;
$$;
revoke all on function public.write_audit(text,text,text,jsonb,jsonb,text) from public;
grant execute on function public.write_audit(text,text,text,jsonb,jsonb,text) to authenticated;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare entity text;
begin
  entity := coalesce(new.id::text, old.id::text);
  insert into public.audit_log(actor_id, entity_table, entity_id, action, old_values, new_values)
  values (
    public.current_app_user_id(), tg_table_name, entity, lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.audit_row_change();
create trigger trucks_audit after insert or update or delete on public.trucks for each row execute function public.audit_row_change();
create trigger dumpsters_audit after insert or update or delete on public.dumpsters for each row execute function public.audit_row_change();
create trigger users_audit after insert or update or delete on public.users for each row execute function public.audit_row_change();

create or replace function public.validate_job_transition() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status in ('en_route','cancelled')) or
    (old.status = 'en_route' and new.status in ('arrived','cancelled')) or
    (old.status = 'arrived' and new.status in ('complete','cancelled'))
  ) then
    raise exception 'Invalid job status transition from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;
create trigger jobs_validate_transition before update of status on public.jobs for each row execute function public.validate_job_transition();

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
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select full_name into actor_name from public.users where id = actor_id;
  insert into public.jobs(customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,notes,traffic_instructions,created_by_id)
  values (customer_id,job_address,job_phone,service,container_size,driver_id,truck_id,dumpster_id,schedule_at,coalesce(job_notes,''),nullif(traffic,''),actor_id)
  returning * into created;
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
grant execute on function public.create_job(text,text,text,text,text,text,text,text,timestamptz,text,text) to authenticated;

create or replace function public.assign_job(target_job_id text, driver_id text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; previous text; changed public.jobs;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select assigned_driver_id into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if not found then raise exception 'Job not found'; end if;
  update public.jobs set assigned_driver_id = driver_id where id = target_job_id returning * into changed;
  select full_name into actor_name from public.users where id = actor_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
  values (target_job_id,actor_id,actor_name,'assigned','Driver assignment updated.',true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
  values (driver_id,'dispatcher','job_assignment','Job assigned: ' || changed.reference,'You have been assigned ' || changed.reference || '.',target_job_id);
  perform public.write_audit('jobs',target_job_id,'assign_driver',jsonb_build_object('assigned_driver_id',previous),jsonb_build_object('assigned_driver_id',driver_id),null);
  return changed;
end;
$$;
grant execute on function public.assign_job(text,text) to authenticated;

create or replace function public.cancel_job(target_job_id text, cancel_reason text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare changed public.jobs;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if length(trim(coalesce(cancel_reason,''))) < 3 then raise exception 'Cancellation reason is required'; end if;
  update public.jobs set status = 'cancelled', cancellation_reason = trim(cancel_reason)
  where id = target_job_id and deleted_at is null returning * into changed;
  if changed.id is null then raise exception 'Job not found'; end if;
  perform public.write_audit('jobs',target_job_id,'cancel',null,to_jsonb(changed),cancel_reason);
  return changed;
end;
$$;
grant execute on function public.cancel_job(text,text) to authenticated;

create or replace function public.update_assigned_job_status(target_job_id text, next_status public.job_status)
returns void language plpgsql security definer set search_path = '' as $$
declare app_user_id text := public.current_app_user_id(); actor text; event_name public.job_activity_type; target public.jobs;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  select * into target from public.jobs where id = target_job_id and deleted_at is null for update;
  if target.id is null then raise exception 'Job not found'; end if;
  if not public.is_staff() and target.assigned_driver_id <> app_user_id then raise exception 'Job is not assigned to this user'; end if;
  if next_status not in ('en_route','arrived','complete') then raise exception 'Unsupported driver status'; end if;
  if next_status = 'complete' and not exists (select 1 from public.job_photos where job_id = target_job_id) then raise exception 'At least one completion photo is required'; end if;
  select full_name into actor from public.users where id = app_user_id;
  event_name := case when next_status = 'complete' then 'completed'::public.job_activity_type else next_status::text::public.job_activity_type end;
  update public.jobs set status = next_status where id = target_job_id;
  insert into public.job_events(job_id,event_type,occurred_at) values (target_job_id,event_name,now()) on conflict (job_id,event_type) do update set occurred_at=excluded.occurred_at;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values (target_job_id,app_user_id,actor,event_name,case when next_status='complete' then 'Job completed' else 'Driver marked '||replace(next_status::text,'_',' ') end,true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
  select u.id,'driver','driver_status',actor||': '||target.reference,'Job status changed to '||replace(next_status::text,'_',' '),target.id from public.users u where u.access_role in ('admin','dispatcher') and u.status='active' and u.deleted_at is null;
end;
$$;

create or replace function public.complete_job_as_dispatch(target_job_id text, override_reason text default null)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare changed public.jobs; has_photo boolean;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select exists(select 1 from public.job_photos where job_id=target_job_id) into has_photo;
  if not has_photo and length(trim(coalesce(override_reason,''))) < 3 then raise exception 'An override reason is required when no photo exists'; end if;
  update public.jobs set status='complete' where id=target_job_id and status='arrived' and deleted_at is null returning * into changed;
  if changed.id is null then raise exception 'Only an arrived job can be completed'; end if;
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,'completed',now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  perform public.write_audit('jobs',target_job_id,'dispatcher_complete',null,to_jsonb(changed),override_reason);
  return changed;
end;
$$;
grant execute on function public.complete_job_as_dispatch(text,text) to authenticated;

create or replace function public.record_time_event(next_type public.time_entry_type)
returns public.time_entries language plpgsql security definer set search_path = '' as $$
declare app_user_id text := public.current_app_user_id(); previous public.time_entry_type; created public.time_entries; expected public.time_entry_type;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext(app_user_id));
  select entry_type into previous from public.time_entries where user_id=app_user_id order by occurred_at desc limit 1;
  expected := case when previous is null or previous='clock_out' then 'clock_in' when previous='clock_in' then 'break_start' when previous='break_start' then 'break_end' when previous='break_end' then 'clock_out' end;
  if next_type <> expected then raise exception 'Invalid time event. Expected %', expected; end if;
  insert into public.time_entries(user_id,entry_type,occurred_at) values(app_user_id,next_type,now()) returning * into created;
  perform public.write_audit('time_entries',created.id,'create',null,to_jsonb(created),null);
  return created;
end;
$$;
grant execute on function public.record_time_event(public.time_entry_type) to authenticated;

create or replace function public.review_time_request(request_id text, decision text)
returns public.time_requests language plpgsql security definer set search_path = '' as $$
declare reviewer text := public.current_app_user_id(); request public.time_requests;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if decision not in ('approved','denied') then raise exception 'Decision must be approved or denied'; end if;
  update public.time_requests set status=decision,reviewed_by_id=reviewer,reviewed_at=now()
  where id=request_id and status='pending' returning * into request;
  if request.id is null then raise exception 'Pending request not found'; end if;
  if decision='approved' and request.kind='edit_time' then
    if request.requested_entry_type is null or request.requested_at is null then raise exception 'Correction details are incomplete'; end if;
    insert into public.time_entry_corrections(request_id,original_entry_id,user_id,replacement_type,replacement_at,reason,approved_by_id)
    values(request.id,request.target_entry_id,request.user_id,request.requested_entry_type,request.requested_at,request.reason,reviewer);
  elsif decision='approved' and request.kind='pto' then
    insert into public.absence_events(user_id,event_date,absence_type,status,note)
    values(request.user_id,request.requested_for,'pto','approved',request.reason);
  end if;
  perform public.write_audit('time_requests',request.id,'review',null,to_jsonb(request),decision);
  return request;
end;
$$;
grant execute on function public.review_time_request(text,text) to authenticated;

alter publication supabase_realtime add table public.time_entry_corrections;
alter publication supabase_realtime add table public.audit_log;
