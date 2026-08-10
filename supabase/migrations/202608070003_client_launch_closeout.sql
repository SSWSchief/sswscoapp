-- Client launch controls: data-driven protected administrators and a single,
-- transaction-safe training dataset that can be removed without broad matches.

create table public.protected_administrators(
  user_id text primary key references public.users(id) on delete restrict,
  reason text not null check(length(trim(reason)) between 3 and 200),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.protected_administrators enable row level security;

insert into public.protected_administrators(user_id,reason,expires_at)
select id,
  case lower(email)
    when 'amarshall@sswsco.com' then 'Client owner administrator'
    else 'Indefinite application support administrator'
  end,
  null
from public.users
where lower(email) in ('amarshall@sswsco.com','tehronporter@gmail.com')
on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at;

drop trigger if exists enforce_owner_profile_access_before_write on public.users;
drop function if exists public.enforce_owner_profile_access();

create function public.enforce_protected_administrator_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare protected boolean;
begin
  select exists(
    select 1 from public.protected_administrators p
    where p.user_id=old.id and (p.expires_at is null or p.expires_at>now())
  ) into protected;
  if protected and (
    tg_op='DELETE' or new.access_role<>'admin' or new.role<>'management'
    or new.status<>'active' or new.deleted_at is not null
    or new.permission_overrides<>'{}'::jsonb
  ) then
    raise exception 'Protected administrators must retain active full administrator access';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger users_enforce_protected_administrator
before update or delete on public.users
for each row execute function public.enforce_protected_administrator_access();

create function public.list_protected_administrator_ids()
returns table(user_id text)
language sql stable security definer set search_path='' as $$
  select p.user_id
  from public.protected_administrators p
  where public.admin_mfa_verified()
    and (p.expires_at is null or p.expires_at>now())
  order by p.user_id
$$;
revoke all on function public.list_protected_administrator_ids() from public,anon;
grant execute on function public.list_protected_administrator_ids() to authenticated,service_role;

create table public.training_datasets(
  dataset_key text primary key check(dataset_key='training-v1'),
  status text not null check(status in('active','removed')),
  record_ids jsonb not null,
  created_by_id text references public.users(id),
  created_at timestamptz not null default now(),
  removed_by_id text references public.users(id),
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint training_dataset_lifecycle check(
    (status='active' and removed_by_id is null and removed_at is null)
    or (status='removed' and removed_at is not null)
  )
);
alter table public.training_datasets enable row level security;

create function public.get_training_dataset_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare dataset public.training_datasets;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  select * into dataset from public.training_datasets where dataset_key='training-v1';
  if dataset.dataset_key is null then
    return jsonb_build_object('datasetKey','training-v1','status','not_provisioned','recordIds','{}'::jsonb);
  end if;
  return jsonb_build_object(
    'datasetKey',dataset.dataset_key,
    'status',dataset.status,
    'recordIds',dataset.record_ids,
    'createdAt',dataset.created_at,
    'removedAt',dataset.removed_at
  );
end;
$$;

create function public.provision_training_dataset()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor text:=public.current_app_user_id();
  dataset public.training_datasets;
  record_ids constant jsonb:=jsonb_build_object(
    'customerId','training-v1-customer',
    'truckId','training-v1-truck',
    'dumpsterId','training-v1-dumpster',
    'jobId','training-v1-job',
    'invoiceId','training-v1-invoice'
  );
  created_counts jsonb:=jsonb_build_object('customers',0,'trucks',0,'dumpsters',0,'jobs',0,'invoices',0);
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  select * into dataset from public.training_datasets where dataset_key='training-v1' for update;
  if dataset.status='active' then
    return jsonb_build_object('datasetKey','training-v1','status','active','createdCounts',created_counts,'idempotent',true);
  end if;
  if exists(select 1 from public.customers where id='training-v1-customer')
    or exists(select 1 from public.trucks where id='training-v1-truck')
    or exists(select 1 from public.dumpsters where id='training-v1-dumpster')
    or exists(select 1 from public.jobs where id='training-v1-job')
    or exists(select 1 from public.invoices where id='training-v1-invoice')
  then raise exception 'Reserved training identifiers are already in use'; end if;

  insert into public.customers(id,name,address,customer_group,is_active)
  values('training-v1-customer','TRAINING — DELETE ME','100 Training Way — Not a real customer','Commercial',true);
  insert into public.trucks(id,number,type,status,license_plate,mileage,notes,last_known_location)
  values('training-v1-truck','TRAINING-TRUCK-01','Training Roll-off Truck','in_use','',0,'TRAINING — DELETE ME','Yard');
  insert into public.dumpsters(id,code,size,status,type,current_location,notes)
  values('training-v1-dumpster','TRAINING-DUMPSTER-01','20 Yard','in_yard','Roll-off','Yard','TRAINING — DELETE ME');
  insert into public.jobs(
    id,reference,customer_id,address,service_type,dumpster_size,
    assigned_driver_id,assigned_truck_id,assigned_dumpster_id,scheduled_for,
    status,notes,created_by_id
  ) values(
    'training-v1-job','#TRAINING-001','training-v1-customer',
    '100 Training Way — Not a real job','Delivery','20 Yard',null,
    'training-v1-truck','training-v1-dumpster',date_trunc('day',now())+interval '1 day 16 hours',
    'pending','TRAINING — DELETE ME. No real service is scheduled.',actor
  );
  insert into public.job_events(job_id,event_type,occurred_at) values
    ('training-v1-job','created',now()),
    ('training-v1-job','assigned',null),
    ('training-v1-job','en_route',null),
    ('training-v1-job','arrived',null),
    ('training-v1-job','completed',null);
  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
  select 'training-v1-job',actor,full_name,'created','Training job created. It is safe to remove from Settings.',false
  from public.users where id=actor;
  insert into public.invoices(
    id,invoice_number,customer_id,job_id,amount_cents,status,due_date,notes,created_by_id
  ) values(
    'training-v1-invoice','TRAINING-INV-001','training-v1-customer','training-v1-job',0,
    'draft',current_date+30,'TRAINING — DELETE ME. Not a real invoice.',actor
  );
  created_counts:=jsonb_build_object('customers',1,'trucks',1,'dumpsters',1,'jobs',1,'invoices',1);
  insert into public.training_datasets(dataset_key,status,record_ids,created_by_id,created_at,removed_by_id,removed_at,updated_at)
  values('training-v1','active',record_ids,actor,now(),null,null,now())
  on conflict(dataset_key) do update set
    status='active',record_ids=excluded.record_ids,created_by_id=actor,created_at=now(),
    removed_by_id=null,removed_at=null,updated_at=now();
  perform public.write_audit('training_datasets','training-v1','provision',null,record_ids,'Administrator provisioned the controlled training dataset');
  return jsonb_build_object('datasetKey','training-v1','status','active','createdCounts',created_counts,'idempotent',false);
end;
$$;

create function public.remove_training_dataset(requested_dataset_key text)
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

  delete from public.invoices where id='training-v1-invoice';
  get diagnostics deleted_count=row_count;
  deleted_counts:=jsonb_set(deleted_counts,'{invoices}',to_jsonb(deleted_count));
  delete from public.jobs where id='training-v1-job';
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

revoke all on function public.get_training_dataset_status() from public,anon;
revoke all on function public.provision_training_dataset() from public,anon;
revoke all on function public.remove_training_dataset(text) from public,anon;
grant execute on function public.get_training_dataset_status() to authenticated,service_role;
grant execute on function public.provision_training_dataset() to authenticated,service_role;
grant execute on function public.remove_training_dataset(text) to authenticated,service_role;

comment on table public.protected_administrators is 'Service-managed identities that must retain active full administrator access.';
comment on table public.training_datasets is 'Registry for the single controlled, removable production training dataset.';
