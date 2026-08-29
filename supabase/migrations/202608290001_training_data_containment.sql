-- The controlled training customer/truck/dumpster (training-v1-*) is meant to
-- stay confined to the single unassigned job that provision_training_dataset
-- creates. Nothing stopped staff from also picking "TRAINING — DELETE ME" in
-- the regular Create Job form and assigning a real driver to it — which is
-- exactly what happened before this migration (job #1053), sending a real
-- push notification for a fake job and leaving a stray row that
-- remove_training_dataset could not clean up (its deletes only ever targeted
-- the five fixed training-v1-* ids, so the extra job's foreign key to the
-- training customer made the whole removal transaction fail).
--
-- This closes both ends: real jobs can no longer be created, edited, or
-- assigned against the training fixtures, and removal now deletes by
-- reference to the training customer/truck/dumpster rather than by fixed id,
-- so any stray record — past or future — no longer blocks cleanup.

create or replace function public.create_job(
  customer_id text, job_address text, job_phone text, service text, container_size text,
  driver_id text, truck_id text, dumpster_id text, schedule_at timestamptz,
  job_notes text default '', traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text := public.current_app_user_id(); actor_name text; created public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if customer_id='training-v1-customer' then raise exception 'The training customer cannot be used for real jobs. Use Create Training Data in Settings instead.'; end if;
  if not exists(select 1 from public.customers where id=customer_id and is_active and deleted_at is null) then raise exception 'Active customer is required'; end if;
  perform public.assert_active_user(driver_id, 'driver');
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.jobs(customer_id,address,phone,service_type,dumpster_size,assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,notes,traffic_instructions,created_by_id)
  values(customer_id,trim(job_address),trim(coalesce(job_phone,'')),service,container_size,driver_id,truck_id,dumpster_id,schedule_at,trim(coalesce(job_notes,'')),nullif(trim(coalesce(traffic,'')),''),actor_id)
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

create or replace function public.edit_job(
  target_job_id text, customer_id text, job_address text, job_phone text, service text,
  container_size text, driver_id text, truck_id text, dumpster_id text,
  schedule_at timestamptz, job_notes text default '', traffic text default ''
) returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text:=public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status <> 'pending' then raise exception 'Only pending jobs can be edited'; end if;
  if customer_id='training-v1-customer' or previous.customer_id='training-v1-customer' then raise exception 'The training customer cannot be used for real jobs.'; end if;
  if not exists(select 1 from public.customers where id=customer_id and is_active and deleted_at is null) then raise exception 'Active customer is required'; end if;
  perform public.assert_active_user(driver_id,'driver');
  update public.jobs set customer_id=edit_job.customer_id,address=trim(job_address),phone=trim(coalesce(job_phone,'')),
    service_type=service,dumpster_size=container_size,assigned_driver_id=driver_id,assigned_truck_id=truck_id,
    assigned_dumpster_id=dumpster_id,scheduled_for=schedule_at,notes=trim(coalesce(job_notes,'')),
    traffic_instructions=nullif(trim(coalesce(traffic,'')),'') where id=target_job_id returning * into changed;
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

create or replace function public.assign_job(target_job_id text, driver_id text)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare actor_id text:=public.current_app_user_id(); actor_name text; previous public.jobs; changed public.jobs;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  perform public.assert_active_user(driver_id,'driver');
  select * into previous from public.jobs where id=target_job_id and deleted_at is null for update;
  if previous.id is null or previous.status <> 'pending' then raise exception 'Only pending jobs can be assigned'; end if;
  if previous.customer_id='training-v1-customer' then raise exception 'Training jobs cannot be assigned a driver.'; end if;
  update public.jobs set assigned_driver_id=driver_id where id=target_job_id returning * into changed;
  select full_name into actor_name from public.users where id=actor_id;
  insert into public.job_events(job_id,event_type,occurred_at) values(target_job_id,'assigned',now()) on conflict(job_id,event_type) do update set occurred_at=excluded.occurred_at;
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified) values(target_job_id,actor_id,actor_name,'assigned','Driver assignment updated.',true);
  insert into public.notifications(recipient_user_id,source_role,category,title,body,related_job_id) values(driver_id,'dispatcher','job_assignment','Job assigned: '||changed.reference,'You have been assigned '||changed.reference||'.',target_job_id);
  perform public.write_audit('jobs',target_job_id,'assign_driver',to_jsonb(previous),to_jsonb(changed),null);
  return changed;
end;
$$;

create or replace function public.remove_training_dataset(requested_dataset_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor text:=public.current_app_user_id();
  dataset public.training_datasets;
  deleted_count integer;
  deleted_counts jsonb:=jsonb_build_object('customers',0,'trucks',0,'dumpsters',0,'jobs',0,'invoices',0);
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if requested_dataset_key<>'training-v1' then raise exception 'Unknown training dataset'; end if;
  select * into dataset from public.training_datasets where dataset_key=requested_dataset_key for update;
  if dataset.dataset_key is null or dataset.status='removed' then
    return jsonb_build_object('datasetKey',requested_dataset_key,'status','removed','deletedCounts',deleted_counts,'idempotent',true);
  end if;
  if dataset.record_ids<>jsonb_build_object(
    'customerId','training-v1-customer','truckId','training-v1-truck',
    'dumpsterId','training-v1-dumpster','jobId','training-v1-job','invoiceId','training-v1-invoice'
  ) then raise exception 'Training dataset registry failed integrity validation'; end if;

  -- Delete by reference to the training fixtures rather than by the five
  -- fixed ids: any job (and, transitively, its events/activities/notes/
  -- photos/notifications, all ON DELETE CASCADE) that staff created against
  -- the training customer or its truck/dumpster is fake by definition and
  -- gets removed with it, instead of foreign-key-blocking the whole pass.
  delete from public.invoices
    where customer_id='training-v1-customer'
       or job_id in (
         select id from public.jobs
         where customer_id='training-v1-customer'
            or assigned_truck_id='training-v1-truck'
            or assigned_dumpster_id='training-v1-dumpster'
       );
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{invoices}',to_jsonb(deleted_count));
  delete from public.jobs
    where customer_id='training-v1-customer'
       or assigned_truck_id='training-v1-truck'
       or assigned_dumpster_id='training-v1-dumpster';
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{jobs}',to_jsonb(deleted_count));
  delete from public.dumpsters where id='training-v1-dumpster';
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{dumpsters}',to_jsonb(deleted_count));
  delete from public.trucks where id='training-v1-truck';
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{trucks}',to_jsonb(deleted_count));
  delete from public.customers where id='training-v1-customer';
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{customers}',to_jsonb(deleted_count));
  update public.training_datasets set status='removed',removed_by_id=actor,removed_at=now(),updated_at=now()
  where dataset_key=requested_dataset_key;
  perform public.write_audit('training_datasets',requested_dataset_key,'remove',dataset.record_ids,deleted_counts,'Administrator removed the controlled training dataset');
  return jsonb_build_object('datasetKey',requested_dataset_key,'status','removed','deletedCounts',deleted_counts,'idempotent',false);
end;
$$;
