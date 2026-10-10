begin;
select plan(21);

create function pg_temp.as_user(auth_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', auth_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000001','authenticated','authenticated','adv-dispatch@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000002','authenticated','authenticated','adv-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('adv-dispatch','50000000-0000-0000-0000-000000000001','ADV-DISP','Adv Dispatch','adv-dispatch@example.invalid','dispatcher','dispatcher','{}','active','AD'),
  ('adv-driver','50000000-0000-0000-0000-000000000002','ADV-DRV','Adv Driver','adv-driver@example.invalid','driver','driver','{}','active','AV');
insert into public.customers(id,name) values ('adv-cust','Sold Not Delivered');
insert into public.dumpsters(id,code,size) values ('adv-can','ADV-A','20 Yard');
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_driver_id,assigned_dumpster_id,scheduled_for) values
  ('no-driver','adv-cust','1 Sub Way','Delivery','20 Yard',null,null,now()),
  ('forgot-complete','adv-cust','2 Forgot Way','Delivery','20 Yard','adv-driver','adv-can',now()),
  ('forgot-arrive','adv-cust','3 Forgot Way','Delivery','20 Yard','adv-driver',null,now()),
  ('closed-already','adv-cust','4 Done Way','Delivery','20 Yard','adv-driver',null,now());

set local role authenticated;

-- A job nobody drove, with no photo, still reaches complete in one call.
select pg_temp.as_user('50000000-0000-0000-0000-000000000001');
select lives_ok($$select public.advance_job_as_dispatch('no-driver','complete','competitor delivered the can')$$,'dispatch completes a pending job with no driver');
select is((select status::text from public.jobs where id='no-driver'),'complete','the job is complete');
select is((select count(*) from public.job_events where job_id='no-driver'),3::bigint,'each skipped step is recorded as an event');
select is((select count(*) from public.job_activities where job_id='no-driver' and body like 'Dispatch marked%: competitor delivered the can'),3::bigint,'each step names the reason in the history');

-- A driver-assigned job moves stepwise and keeps its assets in step.
select lives_ok($$select public.advance_job_as_dispatch('forgot-arrive','arrived','driver forgot to tap')$$,'dispatch marks a job arrived');
select is((select status::text from public.jobs where id='forgot-arrive'),'arrived','the job is arrived');
select lives_ok($$select public.advance_job_as_dispatch('forgot-complete','complete','driver forgot to tap')$$,'dispatch completes a driver job without a photo');
select is((select status::text from public.dumpsters where id='adv-can'),'out','a completed delivery leaves its can out at the site');
select is((select count(*) from public.container_placements where dumpster_id='adv-can' and retrieved_at is null),1::bigint,'the completed delivery opens the rental');

-- Guard rails.
select throws_ok($$select public.advance_job_as_dispatch('forgot-arrive','arrived','again')$$,'Choose a step after the current status','the same status is refused');
select throws_ok($$select public.advance_job_as_dispatch('forgot-arrive','en_route','back')$$,'Choose a step after the current status','going backwards is refused');
select throws_ok($$select public.advance_job_as_dispatch('no-driver','complete','twice')$$,'Only an open job can be advanced','a complete job is refused');
select throws_ok($$select public.advance_job_as_dispatch('closed-already','pending','x y z')$$,'Choose en route, arrived or complete','pending is not a target');
select throws_ok($$select public.advance_job_as_dispatch('closed-already','complete','  ')$$,'A reason is required','a blank reason is refused');
select throws_ok($$select public.advance_job_as_dispatch('missing','complete','no such job')$$,'Job not found','an unknown job is refused');
select is((select status::text from public.jobs where id='closed-already'),'pending','refusals leave the job alone');

-- Only people with the jobs permission can do it.
select pg_temp.as_user('50000000-0000-0000-0000-000000000002');
select throws_ok($$select public.advance_job_as_dispatch('closed-already','complete','driver trying')$$,'Jobs permission required','a driver cannot use the dispatch function');

-- Someone who is not signed in has no profile, so has_permission() is NULL.
select pg_temp.as_user('50000000-0000-0000-0000-0000000000ff');
select throws_ok($$select public.advance_job_as_dispatch('closed-already','complete','not signed in')$$,'Jobs permission required','a caller with no profile is refused');
select is(has_function_privilege('anon','public.advance_job_as_dispatch(text,public.job_status,text)','execute'),false,'anon cannot execute it at all');

reset role;
select is((select status::text from public.jobs where id='closed-already'),'pending','the driver attempt changed nothing');
-- The audit log is not readable by the browser role, so check it as the owner.
select is((select count(*) from public.audit_log where entity_id='no-driver' and action='dispatcher_advance' and reason='competitor delivered the can'),1::bigint,'one audit row records who and why');

select * from finish();
rollback;
