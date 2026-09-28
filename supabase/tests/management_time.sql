begin;
select plan(17);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000001','authenticated','authenticated','time-admin@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000002','authenticated','authenticated','time-driver@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000003','authenticated','authenticated','time-other@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('time-admin','20000000-0000-0000-0000-000000000001','TIME-ADMIN','Time Admin','time-admin@example.invalid','management','admin','{}','active','TA'),
  ('time-driver','20000000-0000-0000-0000-000000000002','TIME-DRIVER','Time Driver','time-driver@example.invalid','driver','driver','{}','active','TD'),
  ('time-other','20000000-0000-0000-0000-000000000003','TIME-OTHER','Other Driver','time-other@example.invalid','driver','driver','{}','active','TO');
insert into public.dumpsters(id,code,size,status,current_location) values
  ('time-dumpster-a','TIME-D-A','20 Yard','out','Customer A'),
  ('time-dumpster-b','TIME-D-B','40 Yard','in_yard','Yard');
insert into public.dumpsters(id,code,size,status,current_location,deleted_at)
  values('time-dumpster-deleted','TIME-D-DELETED','10 Yard','in_shop','Retired',now());
insert into public.time_entries(id,user_id,entry_type,occurred_at)
  values('time-punch','time-driver','clock_in','2026-09-24T15:00:00Z');

select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is((public.save_paid_time_adjustment('time-driver','2026-09-24',240,'Minimum and meeting')).paid_minutes,240,'admin records owed paid minutes');
select is((select count(*) from public.paid_time_adjustments where user_id='time-driver' and voided_at is null),1::bigint,'paid adjustment is active');
select is((public.save_paid_time_adjustment('time-driver','2026-09-24',300,'Revised minimum and meeting',(select id from public.paid_time_adjustments where user_id='time-driver' and voided_at is null))).paid_minutes,300,'admin revises owed hours');
select is((select count(*) from public.paid_time_adjustments where user_id='time-driver' and voided_at is not null),1::bigint,'prior adjustment remains as reversed history');
select is((public.void_paid_time_adjustment((select id from public.paid_time_adjustments where user_id='time-driver' and voided_at is null),'Entered twice')).void_reason,'Entered twice','admin reverses an adjustment with a reason');
select is((select count(*) from public.paid_time_adjustments where user_id='time-driver' and voided_at is null),0::bigint,'reversed hours no longer count');
select is((public.manage_time_correction('time-driver','clock_in','2026-09-24T14:00:00Z','Corrected start','time-punch')).original_entry_id,'time-punch','admin corrects employee punch directly');
select is((public.manage_time_correction('time-driver','clock_in','2026-09-24T13:00:00Z','Revised start',null,(select id from public.time_entry_corrections where user_id='time-driver' and superseded_at is null))).replacement_at,'2026-09-24T13:00:00Z'::timestamptz,'admin revises a correction');
select is((select count(*) from public.time_entry_corrections where user_id='time-driver' and superseded_at is null),1::bigint,'only the latest correction affects time');
select is(pg_temp.sqlstate_of($$select public.manage_time_correction('time-driver','clock_out','2026-09-24T12:00:00Z','Impossible order')$$),'P0001','management cannot record an impossible punch sequence');
select is((select count(*) from public.audit_log where entity_table in ('paid_time_adjustments','time_entry_corrections') and actor_id='time-admin') > 0,true,'management time actions are audited');
select is((public.save_paid_time_adjustment('time-other','2026-09-24',60,'Meeting pay')).paid_minutes,60,'second employee adjustment saved');

select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(pg_temp.sqlstate_of($$select public.save_paid_time_adjustment('time-driver','2026-09-24',60,'Unauthorized')$$),'P0001','driver cannot adjust time');
select is(pg_temp.sqlstate_of($$select public.manage_time_correction('time-driver','clock_in','2026-09-24T12:00:00Z','Unauthorized')$$),'P0001','driver cannot correct punches');
select results_eq($$select code from public.dumpsters where code like 'TIME-D-%' order by code$$,$$values ('TIME-D-A'::text),('TIME-D-B'::text)$$,'driver sees all active dumpsters');
select is((select count(*) from public.dumpsters where id='time-dumpster-deleted'),0::bigint,'driver cannot read retired dumpster rows');
select is((select count(*) from public.paid_time_adjustments where user_id='time-other'),0::bigint,'driver cannot see another employee adjustment');

reset role;
select * from finish();
rollback;
