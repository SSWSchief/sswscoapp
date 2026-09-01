-- Two things dispatch asked for on the job form.
--
-- 1. Taking a job for a customer who is not on the list yet.
--
-- The customer field was a required picker over existing records, so a
-- one-off or a walk-up could not be booked until somebody left the form, made
-- a customer, and came back. Dispatch asked to be able to type a name.
--
-- It is resolved to a real customer row rather than stored as loose text on
-- the job. jobs.customer_id is a foreign key and invoicing is keyed on it, so
-- a job carrying only a typed name could never be billed — which is the
-- opposite of what a new customer is for. A name that already belongs to an
-- active customer reuses that record instead of creating a second one, since
-- two "Vegas GC" rows would split an account's jobs and its invoices.
--
-- 2. Recording which representative won the work, so progress can be tracked
--    by rep and a bonus structure built on it later.

alter table public.jobs
  add column if not exists sales_rep_id text references public.users(id) on delete set null;

comment on column public.jobs.sales_rep_id is
  'The representative who brought in this job. Nullable: most work arrives without one, and it is recorded for tracking and eventual bonus calculation rather than for dispatch.';

create index if not exists jobs_sales_rep_idx
  on public.jobs (sales_rep_id, scheduled_for) where sales_rep_id is not null;

-- Resolving a customer from either an id or a typed name, shared by both job
-- functions so create and edit cannot drift apart on it.
create or replace function public.resolve_customer(customer_id text, customer_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare resolved text; trimmed text := nullif(trim(coalesce(customer_name,'')),'');
begin
  if nullif(trim(coalesce(customer_id,'')),'') is not null then
    resolved := customer_id;
    if resolved = 'training-v1-customer' then
      raise exception 'The training customer cannot be used for real jobs. Use Create Training Data in Settings instead.';
    end if;
    if not exists(select 1 from public.customers where id=resolved and is_active and deleted_at is null) then
      raise exception 'Active customer is required';
    end if;
    return resolved;
  end if;

  if trimmed is null then raise exception 'Select a customer or type a name'; end if;

  -- Case-insensitive, because "vegas gc" typed in a hurry is the same account
  -- as "Vegas GC" and must not become a second one.
  select id into resolved from public.customers
   where lower(name)=lower(trimmed) and is_active and deleted_at is null
   order by created_at limit 1;
  if resolved is not null then return resolved; end if;

  insert into public.customers(name) values (trimmed) returning id into resolved;
  perform public.write_audit('customers',resolved,'create',null,jsonb_build_object('name',trimmed,'source','job_form'),null);
  return resolved;
end;
$$;

revoke all on function public.resolve_customer(text,text) from public,anon,authenticated;

drop function if exists public.create_job(text,text,text,text,text,text,text,text,timestamptz,text,text);

create function public.create_job(
  customer_id text, job_address text, job_phone text, service text, container_size text,
  driver_id text, truck_id text, dumpster_id text, schedule_at timestamptz,
  job_notes text default '', traffic text default '',
  customer_name text default null, rep_id text default null
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; created public.jobs; resolved text;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  resolved := public.resolve_customer(customer_id, customer_name);
  perform public.assert_active_user(driver_id, 'driver');
  perform public.assert_active_user(rep_id);
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.jobs(customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,notes,traffic_instructions,sales_rep_id,created_by_id)
  values(resolved,trim(job_address),trim(coalesce(job_phone,'')),service,container_size,driver_id,truck_id,dumpster_id,schedule_at,trim(coalesce(job_notes,'')),nullif(trim(coalesce(traffic,'')),''),rep_id,actor_id)
  returning * into created;
  insert into public.job_events(job_id,event_type,occurred_at) values
    (created.id,'created',now()),(created.id,'assigned',case when driver_id is null then null else now() end),(created.id,'en_route',null),(created.id,'arrived',null),(created.id,'completed',null);
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    values(created.id,actor_id,actor_name,'created',created.reference||case when driver_id is null then ' created unassigned.' else ' created and assigned.' end,true);
  if driver_id is not null then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
      values(driver_id,'dispatcher','job_assignment','New job assigned: '||created.reference,service||' at '||job_address||'. Please acknowledge this assignment.',created.id);
  end if;
  perform public.write_audit('jobs',created.id,'create',null,to_jsonb(created),null);
  return created;
end;
$$;

grant execute on function public.create_job(text,text,text,text,text,text,text,text,timestamptz,text,text,text,text) to authenticated;

drop function if exists public.edit_job(text,text,text,text,text,text,text,text,text,timestamptz,text,text);

create function public.edit_job(
  target_job_id text, customer_id text, job_address text, job_phone text, service text,
  container_size text, driver_id text, truck_id text, dumpster_id text,
  schedule_at timestamptz, job_notes text default '', traffic text default '',
  customer_name text default null, rep_id text default null
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text:=public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs; resolved text;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status <> 'pending' then raise exception 'Only pending jobs can be edited'; end if;
  if previous.customer_id='training-v1-customer' then raise exception 'The training customer cannot be used for real jobs.'; end if;
  resolved := public.resolve_customer(customer_id, customer_name);
  perform public.assert_active_user(driver_id,'driver');
  perform public.assert_active_user(rep_id);
  update public.jobs set customer_id=resolved,address=trim(job_address),phone=trim(coalesce(job_phone,'')),
    service_type=service,dumpster_size=container_size,assigned_driver_id=driver_id,assigned_truck_id=truck_id,
    assigned_dumpster_id=dumpster_id,scheduled_for=schedule_at,notes=trim(coalesce(job_notes,'')),
    traffic_instructions=nullif(trim(coalesce(traffic,'')),''),sales_rep_id=rep_id where id=target_job_id returning * into changed;
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    values(target_job_id,actor_id,actor_name,'assigned','Job details or assignments updated.',true);
  if driver_id is not null and driver_id is distinct from previous.assigned_driver_id then
    insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id)
      values(driver_id,'dispatcher','job_assignment','Job assigned: '||changed.reference,'You have been assigned '||changed.reference||'.',target_job_id);
  end if;
  perform public.write_audit('jobs',target_job_id,'edit',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;

grant execute on function public.edit_job(text,text,text,text,text,text,text,text,text,timestamptz,text,text,text,text) to authenticated;
