begin;
select plan(20);

create function pg_temp.capture_sqlstate(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

create function pg_temp.execute_row_count(command text) returns bigint language plpgsql as $$
declare affected bigint;
begin
  execute command;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

insert into auth.users(
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','authenticated','authenticated','rls-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000002','authenticated','authenticated','rls-dispatch@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000003','authenticated','authenticated','rls-reduced@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000004','authenticated','authenticated','rls-driver@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000005','authenticated','authenticated','rls-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000006','authenticated','authenticated','rls-inactive@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('rls-admin','10000000-0000-0000-0000-000000000001','RLS-ADMIN','RLS Admin','rls-admin@example.invalid','management','admin','{}','active','RA'),
  ('rls-dispatch','10000000-0000-0000-0000-000000000002','RLS-DISPATCH','RLS Dispatch','rls-dispatch@example.invalid','dispatcher','dispatcher','{}','active','RD'),
  ('rls-reduced','10000000-0000-0000-0000-000000000003','RLS-REDUCED','RLS Reduced','rls-reduced@example.invalid','dispatcher','dispatcher','{"customers":false,"jobs":false}','active','RR'),
  ('rls-driver','10000000-0000-0000-0000-000000000004','RLS-DRIVER','RLS Driver','rls-driver@example.invalid','driver','driver','{}','active','RD'),
  ('rls-other','10000000-0000-0000-0000-000000000005','RLS-OTHER','RLS Other','rls-other@example.invalid','driver','driver','{}','active','RO'),
  ('rls-inactive','10000000-0000-0000-0000-000000000006','RLS-INACTIVE','RLS Inactive','rls-inactive@example.invalid','driver','driver','{}','inactive','RI');

insert into public.customers(id,name,address,is_active) values
  ('rls-customer-a','RLS Customer A','1 Test Way',true),
  ('rls-customer-b','RLS Customer B','2 Test Way',true);
insert into public.jobs(id,reference,customer_id,address,service_type,dumpster_size,assigned_driver_id,scheduled_for,status) values
  ('rls-driver-job','#RLS-DRIVER','rls-customer-a','1 Test Way','Delivery','20 Yard','rls-driver',now(),'pending'),
  ('rls-other-job','#RLS-OTHER','rls-customer-b','2 Test Way','Delivery','20 Yard','rls-other',now(),'pending');

update public.users
set role='driver',
    access_role='driver',
    status='inactive',
    permission_overrides='{"settings":false}'::jsonb
where lower(email)='amarshall@sswsco.com';

select is((select access_role from public.users where lower(email)='amarshall@sswsco.com'),'admin'::public.access_role,'Austin owner profile retains administrator access');
select is((select role from public.users where lower(email)='tehronporter@gmail.com'),'management'::public.user_role,'Tehron owner profile is a management profile');
select is((select status from public.users where lower(email)='amarshall@sswsco.com'),'active'::public.employee_status,'Owner profile cannot be deactivated by data import/update');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is(public.has_permission('management'),true,'active admin AAL1 receives administrator permissions while MFA is temporarily disabled');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.has_permission('management'),true,'active admin AAL2 continues to receive administrator permissions');
select is((public.save_company_settings('RLS Company','100 Test Way','555-0100','settings@example.invalid','America/Los_Angeles','MM/DD/YYYY',365,'QA')).invoice_prefix,'QA','active admin saves validated company settings through RPC');
select is(pg_temp.execute_row_count($$update public.company_settings set company_name='Direct Hack' where id=true$$),0::bigint,'direct settings table update is denied even for an administrator session');
select is((public.publish_sop_document('RLS Safety SOP','Safety','Use wheel chocks before inspection.',true)).version,1,'admin publishes SOP versions through RPC');
select is((public.publish_pretrip_template('RLS Pretrip',array['Tires','Lights'])).version,1,'admin publishes pre-trip templates through RPC');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(public.has_permission('customers'),true,'dispatcher receives default customer permission');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}',true);
select is(public.has_permission('customers'),false,'reduced dispatcher override is authoritative');
select is((select count(*) from public.jobs where id like 'rls-%'),0::bigint,'reduced dispatcher cannot read jobs after revocation');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
select results_eq(
  $$select id from public.jobs where id like 'rls-%' order by id$$,
  $$values ('rls-driver-job'::text)$$,
  'driver reads only the assigned job'
);
select results_eq(
  $$select id from public.users where id like 'rls-%' order by id$$,
  $$values ('rls-driver'::text)$$,
  'driver reads only their own employee profile'
);
select is(pg_temp.capture_sqlstate($$insert into public.jobs(id,reference,customer_id,address,service_type,dumpster_size,scheduled_for,status) values('rls-forbidden-job','#RLS-FORBIDDEN','rls-customer-a','Denied','Delivery','20 Yard',now(),'pending')$$),'42501','direct job insertion is denied');
select is(pg_temp.capture_sqlstate($$insert into public.time_entries(user_id,entry_type,occurred_at) values('rls-driver','clock_in',now())$$),'42501','direct time-event insertion is denied');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal1"}',true);
select is(public.current_app_user_id(),null::text,'inactive profile cannot resolve an application identity');
select is((select count(*) from public.company_settings),0::bigint,'inactive profile cannot read company settings');
select is((select count(*) from public.sop_documents),0::bigint,'inactive profile cannot read published SOPs');
select is((select count(*) from public.pretrip_templates),0::bigint,'inactive profile cannot read published pre-trip templates');

reset role;
select * from finish();
rollback;
