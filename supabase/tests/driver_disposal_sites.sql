begin;
select plan(5);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000001','authenticated','authenticated','site-driver@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000002','authenticated','authenticated','site-blocked@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('site-driver','30000000-0000-0000-0000-000000000001','SITE-DRIVER','Site Driver','site-driver@example.invalid','driver','driver','{}','active','SD'),
  ('site-blocked','30000000-0000-0000-0000-000000000002','SITE-BLOCKED','Blocked Driver','site-blocked@example.invalid','driver','driver','{"driver_jobs":false}','active','BD');
insert into public.disposal_sites(id,name,address,is_active) values
  ('site-open','TEST Open Transfer Station','1 Test Way',true),
  ('site-closed','TEST Closed Landfill','2 Test Way',false);

select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select results_eq($$select id from public.disposal_sites where name like 'TEST %' order by id$$,$$values ('site-open'::text)$$,'driver reads active disposal sites');
select is((select count(*) from public.disposal_sites where id='site-closed'),0::bigint,'driver cannot read inactive disposal sites');
select is(pg_temp.sqlstate_of($$insert into public.disposal_sites(name) values ('Driver Added Site')$$),'42501','driver cannot add disposal sites');
update public.disposal_sites set notes='edited' where id='site-open';
select is((select notes from public.disposal_sites where id='site-open'),'','driver cannot edit disposal sites');

select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.disposal_sites where name like 'TEST %'),0::bigint,'account without driver jobs cannot read disposal sites');

reset role;
select * from finish();
rollback;
