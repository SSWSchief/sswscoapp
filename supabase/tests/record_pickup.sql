begin;
select plan(12);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;
create function pg_temp.as_user(auth_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', auth_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','42000000-0000-0000-0000-000000000001','authenticated','authenticated','pickup-office@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','42000000-0000-0000-0000-000000000002','authenticated','authenticated','pickup-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('pickup-office','42000000-0000-0000-0000-000000000001','PU-OFF','Pickup Office','pickup-office@example.invalid','dispatcher','dispatcher','{}','active','PO'),
  ('pickup-driver','42000000-0000-0000-0000-000000000002','PU-DRV','Pickup Driver','pickup-driver@example.invalid','driver','driver','{}','active','PD');
insert into public.customers(id,name) values ('pu-cust','Jade Lagoon Builder');
insert into public.dumpsters(id,code,size,status,current_location,current_customer_id) values
  ('pu-can-a','PU-A','20 Yard','out','9255 Jade Lagoon Street','pu-cust'),
  ('pu-can-b','PU-B','40 Yard','out','200 E. Harmon Ave','pu-cust'),
  ('pu-can-c','PU-C','20 Yard','out','3005 Contract Avenue','pu-cust');
insert into public.container_placements(id,customer_id,dumpster_id,address,delivered_at) values
  ('pu-open-a','pu-cust','pu-can-a','9255 Jade Lagoon Street',now() - interval '7 days'),
  ('pu-open-b','pu-cust','pu-can-b','200 E. Harmon Ave',now() - interval '7 days'),
  ('pu-open-c','pu-cust','pu-can-c','3005 Contract Avenue',now() - interval '2 days');
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_driver_id,assigned_dumpster_id,scheduled_for,status) values
  ('pu-job-c','pu-cust','3005 Contract Avenue','Pick-Up','20 Yard','pickup-driver','pu-can-c',now(),'en_route');

set local role authenticated;

select pg_temp.as_user('42000000-0000-0000-0000-000000000002');
select is(pg_temp.sqlstate_of($$select public.record_pickup('pu-open-a', current_date)$$),'P0001','a driver without the jobs permission cannot record a pick-up');

select pg_temp.as_user('42000000-0000-0000-0000-000000000001');
select is(pg_temp.sqlstate_of($$select public.record_pickup('pu-open-a', ((now() at time zone 'America/Los_Angeles')::date + 1))$$),'P0001','a future pick-up date is refused');
select is(pg_temp.sqlstate_of($$select public.record_pickup('pu-open-a', ((now() at time zone 'America/Los_Angeles')::date - 30))$$),'P0001','a pick-up date before delivery is refused');
select is(pg_temp.sqlstate_of($$select public.record_pickup('pu-open-c', (now() at time zone 'America/Los_Angeles')::date)$$),'P0001','a pick-up job under way owns the can');

select is(
  ((public.record_pickup('pu-open-a', ((now() at time zone 'America/Los_Angeles')::date - 3))).retrieved_at at time zone 'America/Los_Angeles')::date,
  (now() at time zone 'America/Los_Angeles')::date - 3,
  'an earlier pick-up is recorded on the day given');
select is((select pickup_status from public.container_placements where id='pu-open-a'),'retrieved','the rental reads as retrieved');
select is((select status::text from public.dumpsters where id='pu-can-a'),'in_yard','the dumpster is back in the yard');
select is((select current_location from public.dumpsters where id='pu-can-a'),'Yard','its location reads Yard');
select is((select current_customer_id from public.dumpsters where id='pu-can-a'),null,'it no longer belongs to the customer');
select is(pg_temp.sqlstate_of($$select public.record_pickup('pu-open-a', (now() at time zone 'America/Los_Angeles')::date)$$),'P0001','a closed rental cannot be picked up twice');

select is((public.record_pickup('pu-open-b', (now() at time zone 'America/Los_Angeles')::date)).retrieved_at, now(), 'a pick-up today is stamped now');

reset role;
select is((select count(*) from public.audit_log where entity_table='container_placements' and action='record_pickup'),2::bigint,'each pick-up is audited');

select * from finish();
rollback;
