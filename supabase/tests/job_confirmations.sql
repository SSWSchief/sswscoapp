begin;
select plan(8);

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
  ('00000000-0000-0000-0000-000000000000','70000000-0000-0000-0000-000000000002','authenticated','authenticated','conf-dispatch@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','70000000-0000-0000-0000-000000000003','authenticated','authenticated','conf-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('conf-dispatch','70000000-0000-0000-0000-000000000002','CONF-DSP','Conf Dispatch','conf-dispatch@example.invalid','dispatcher','dispatcher','{}','active','CD'),
  ('conf-driver','70000000-0000-0000-0000-000000000003','CONF-DRV','Conf Driver','conf-driver@example.invalid','driver','driver','{}','active','CV');
insert into public.customers(id,name,email) values ('conf-cust','John Evans','john@example.com');
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,scheduled_for) values
  ('conf-job','conf-cust','1 Main St','Delivery','20 Yard','2026-10-08 15:00+00');

insert into public.job_confirmations(job_id,token_hash,recipient_email,scheduled_for,sent_at)
values ('conf-job','hash-1','john@example.com','2026-10-08 15:00+00',now());

select is(
  pg_temp.sqlstate_of($$insert into public.job_confirmations(job_id,token_hash,recipient_email,scheduled_for) values ('conf-job','hash-2','john@example.com','2026-10-09 15:00+00')$$),
  '23505', 'a job has one current confirmation at a time');
update public.job_confirmations set superseded_at = now() where token_hash = 'hash-1';
select is(
  pg_temp.sqlstate_of($$insert into public.job_confirmations(job_id,token_hash,recipient_email,scheduled_for) values ('conf-job','hash-2','john@example.com','2026-10-09 15:00+00')$$),
  null, 'a reschedule replaces it once the old one is superseded');
select is(
  pg_temp.sqlstate_of($$insert into public.job_confirmations(job_id,token_hash,recipient_email,scheduled_for) values ('conf-job','hash-3','not an email','2026-10-09 15:00+00')$$),
  '23514', 'the recipient must be an email address');
select is(
  pg_temp.sqlstate_of($$update public.job_confirmations set response = 'confirmed' where token_hash = 'hash-2'$$),
  '23514', 'an answer always carries its time');

select pg_temp.as_user('70000000-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*) from public.job_confirmations), 2::bigint, 'dispatch sees confirmations');
select is(
  pg_temp.sqlstate_of($$update public.job_confirmations set response = 'confirmed', responded_at = now()$$),
  '42501', 'only the server records answers');
reset role;

select pg_temp.as_user('70000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*) from public.job_confirmations), 0::bigint, 'drivers do not');
reset role;

set local role anon;
select is(pg_temp.sqlstate_of($$select 1 from public.job_confirmations$$), '42501', 'the public cannot read confirmations');
reset role;

select * from finish();
rollback;
