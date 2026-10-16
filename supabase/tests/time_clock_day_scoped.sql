begin;
select plan(4);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','21000000-0000-0000-0000-000000000001','authenticated','authenticated','clock-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('clock-driver','21000000-0000-0000-0000-000000000001','CLOCK-DRIVER','Clock Driver','clock-driver@example.invalid','driver','driver','{}','active','CD');
-- Clocked in two days ago and never clocked out.
insert into public.time_entries(id,user_id,entry_type,occurred_at)
  values('stale-in','clock-driver','clock_in',now() - interval '2 days');

select set_config('request.jwt.claims','{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;

select is((public.record_time_event('clock_in')).entry_type,'clock_in'::public.time_entry_type,'a missed clock-out on an earlier day does not block clocking in today');
select is(pg_temp.sqlstate_of($$select public.record_time_event('clock_in')$$),'P0001','a second clock-in today is still refused');
-- now() is fixed inside this transaction, so punches after this one would tie
-- on occurred_at; one more is enough to show today's shift runs normally.
select is((public.record_time_event('clock_out')).entry_type,'clock_out'::public.time_entry_type,'clocks out today');

reset role;
select is((select entry_type from public.time_entries where id='stale-in'),'clock_in'::public.time_entry_type,'the earlier open day is left for a correction, not closed silently');

select * from finish();
rollback;
