begin;
select no_plan();

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin execute command; return null; exception when others then return sqlstate; end;
$$;

insert into auth.users(id,email) values
 ('35000000-0000-0000-0000-000000000001','delete-admin@example.invalid'),
 ('35000000-0000-0000-0000-000000000002','delete-driver@example.invalid'),
 ('35000000-0000-0000-0000-000000000003','delete-clean@example.invalid'),
 ('35000000-0000-0000-0000-000000000004','delete-history@example.invalid'),
 ('35000000-0000-0000-0000-000000000005','delete-storage@example.invalid');
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,status,initials) values
 ('delete-admin','35000000-0000-0000-0000-000000000001','DEL-ADMIN','Delete Admin','delete-admin@example.invalid','management','admin','active','DA'),
 ('delete-driver','35000000-0000-0000-0000-000000000002','DEL-DRIVER','Delete Driver','delete-driver@example.invalid','driver','driver','active','DD'),
 ('delete-clean','35000000-0000-0000-0000-000000000003','DEL-CLEAN','Delete Clean','delete-clean@example.invalid','driver','driver','active','DC'),
 ('delete-history','35000000-0000-0000-0000-000000000004','DEL-HISTORY','Delete History','delete-history@example.invalid','driver','driver','active','DH'),
 ('delete-storage','35000000-0000-0000-0000-000000000005','DEL-STORAGE','Delete Storage','delete-storage@example.invalid','driver','driver','active','DS'),
 ('delete-protected',null,'DEL-PROTECTED','Delete Protected','delete-protected@example.invalid','management','admin','active','DP'),
 ('delete-expired',null,'DEL-EXPIRED','Delete Expired','delete-expired@example.invalid','driver','driver','active','DE'),
 ('delete-unlinked',null,'DEL-UNLINKED','Delete Unlinked','delete-unlinked@example.invalid','driver','driver','active','DU');
insert into public.protected_administrators(user_id,reason,expires_at) values
 ('delete-protected','Test protected administrator',null),
 ('delete-expired','Expired administrator protection',now()-interval '1 day');
insert into public.time_entries(user_id,entry_type,occurred_at)
 values('delete-history','clock_in',now());
insert into storage.buckets(id,name) values('employee-delete-test','employee-delete-test');
insert into storage.objects(bucket_id,name,owner_id)
 values('employee-delete-test','owned-file','35000000-0000-0000-0000-000000000005');
insert into public.notifications(recipient_user_id,source_role,category,title,body)
 values('delete-clean','dispatcher','dispatch_update','Test notification','Disposable delivery state');
create table auth.employee_deletion_test_sessions(user_id uuid references auth.users(id) on delete cascade);
insert into auth.employee_deletion_test_sessions values('35000000-0000-0000-0000-000000000003');

set local role anon;
select is(pg_temp.sqlstate_of($cmd$select public.permanently_delete_employee('delete-clean','delete-clean@example.invalid')$cmd$),'42501','anonymous callers cannot execute deletion');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is(public.permanently_delete_employee('delete-clean','delete-clean@example.invalid')->>'code','forbidden','driver cannot delete employees through RPC');
reset role;
select set_config('request.jwt.claims','{"sub":"35000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is(public.permanently_delete_employee('delete-clean','wrong@example.invalid')->>'code','confirmation_mismatch','wrong confirmation does not delete');
select is(public.permanently_delete_employee('missing','missing@example.invalid')->>'code','employee_not_found','unknown employee is reported');
select is(public.permanently_delete_employee('delete-admin','delete-admin@example.invalid')->>'code','self_deletion','administrator cannot delete themselves');
select is(public.permanently_delete_employee('delete-protected','delete-protected@example.invalid')->>'code','administrator_protected','protected owner cannot be deleted');
select is(public.permanently_delete_employee('delete-history','delete-history@example.invalid')->>'code','employee_has_history','time history blocks deletion despite CASCADE FK');
select is(public.permanently_delete_employee('delete-storage','delete-storage@example.invalid')->>'code','employee_has_files','owned storage blocks deletion');
reset role;
select is((select count(*) from public.time_entries where user_id='delete-history'),1::bigint,'payroll history remains');
select ok(exists(select 1 from auth.users where id='35000000-0000-0000-0000-000000000004'),'history check retains sign-in account');

-- An unseen future SET NULL FK must also block, preserving its attribution.
create table public.employee_deletion_test_history(employee_id text references public.users(id) on delete set null);
insert into public.employee_deletion_test_history values('delete-clean');
set local role authenticated;
select is(public.permanently_delete_employee('delete-clean','delete-clean@example.invalid')->>'code','employee_has_history','new nullable business FK is detected automatically');
reset role;
select is((select employee_id from public.employee_deletion_test_history),'delete-clean','nullable reference is not cleared');
drop table public.employee_deletion_test_history;

-- Simulate an Auth failure AFTER profile/cascade removal: the whole operation
-- must roll back rather than leaving a broken employee or lost notifications.
create function pg_temp.reject_auth_deletion() returns trigger language plpgsql as $$
begin raise exception 'Simulated Auth cleanup failure'; end;
$$;
create trigger reject_employee_deletion_test before delete on auth.users
 for each row execute function pg_temp.reject_auth_deletion();
set local role authenticated;
select is(pg_temp.sqlstate_of($cmd$select public.permanently_delete_employee('delete-clean','delete-clean@example.invalid')$cmd$),'P0001','Auth failure aborts the deletion');
reset role;
select ok(exists(select 1 from public.users where id='delete-clean'),'Auth failure restores profile');
select is((select count(*) from public.notifications where recipient_user_id='delete-clean'),1::bigint,'Auth failure restores cascaded delivery state');
select ok(exists(select 1 from auth.users where id='35000000-0000-0000-0000-000000000003'),'Auth failure retains identity');
drop trigger reject_employee_deletion_test on auth.users;

set local role authenticated;
select is(public.permanently_delete_employee('delete-clean',' DELETE-CLEAN@example.invalid ')->>'deleted','true','administrator can delete a clean profile using confirmed email');
select is(public.permanently_delete_employee('delete-expired','delete-expired@example.invalid')->>'deleted','true','expired administrator protection does not prevent deletion');
select is(public.permanently_delete_employee('delete-unlinked','delete-unlinked@example.invalid')->>'deleted','true','profile without Auth account can be deleted');
reset role;
select ok(not exists(select 1 from public.users where id='delete-clean'),'profile is permanently gone');
select ok(not exists(select 1 from auth.users where id='35000000-0000-0000-0000-000000000003'),'sign-in identity is permanently gone');
select is((select count(*) from auth.employee_deletion_test_sessions),0::bigint,'Auth session references cascade');
select is((select count(*) from public.notifications where recipient_user_id='delete-clean'),0::bigint,'disposable notifications are removed');
select ok(exists(select 1 from public.audit_log where entity_id='delete-clean'
 and action='employee_permanently_deleted' and actor_id='delete-admin'),'deletion is attributed to the administrator in audit history');
insert into public.users(id,employee_id,full_name,email,role,access_role,status,initials)
 values('delete-recreated','DEL-CLEAN','Replacement','delete-clean@example.invalid','driver','driver','active','R');
select ok(exists(select 1 from public.users where id='delete-recreated'),'email and employee ID can be reused after permanent deletion');
select * from finish();
rollback;
