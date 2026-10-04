begin;
select plan(7);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;
create function pg_temp.as_user(auth_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', auth_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','80000000-0000-0000-0000-000000000001','authenticated','authenticated','ticket-admin@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','80000000-0000-0000-0000-000000000003','authenticated','authenticated','ticket-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('ticket-admin','80000000-0000-0000-0000-000000000001','TICKET-ADM','Ticket Admin','ticket-admin@example.invalid','management','admin','{}','active','TA'),
  ('ticket-driver','80000000-0000-0000-0000-000000000003','TICKET-DRV','Ticket Driver','ticket-driver@example.invalid','driver','driver','{}','active','TV');
insert into public.customers(id,name) values ('ticket-cust','Penta');
insert into public.disposal_sites(id,name) values ('ticket-site','Apex Landfill');
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_driver_id,scheduled_for) values
  ('ticket-job','ticket-cust','1 Penta Way','Pick-Up','20 Yard','ticket-driver','2026-10-05 15:00+00');

select pg_temp.as_user('80000000-0000-0000-0000-000000000003');
set local role authenticated;
select is(
  pg_temp.sqlstate_of($$select public.record_disposal_ticket('ticket-job', 9340, fee_cents => -1)$$),
  'P0001', 'a landfill charge cannot be negative');
select is(
  pg_temp.sqlstate_of($$select public.record_disposal_ticket('ticket-job', 9340, site_id => 'nowhere')$$),
  'P0001', 'the site must be a known disposal site');
select is(
  (select disposal_fee_cents from public.record_disposal_ticket('ticket-job', 9340, 'T-77', fee_cents => 31290, site_id => 'ticket-site')),
  31290::bigint, 'the driver records the charge printed on the ticket');
select is(
  pg_temp.sqlstate_of($$select public.record_disposal_ticket('ticket-job', 9340)$$),
  null, 'a ticket without a charge still files, as before');
select is(
  (select disposal_fee_cents from public.record_disposal_ticket('ticket-job', 9340, 'T-77', fee_cents => 31290, site_id => 'ticket-site')),
  31290::bigint, 'refiling corrects the same ticket');
reset role;

select is((select count(*) from public.disposal_tickets where job_id = 'ticket-job'), 1::bigint, 'one ticket per job');
select ok(
  (select body from public.job_activities where job_id = 'ticket-job' order by created_at desc, id desc limit 1) like '%$312.90 at Apex Landfill%',
  'dispatch sees the charge and the site in the job activity');

select * from finish();
rollback;
