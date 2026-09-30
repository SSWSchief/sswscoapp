begin;
select plan(37);

create function pg_temp.as_user(auth_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', auth_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000001','authenticated','authenticated','yard-dispatch@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','40000000-0000-0000-0000-000000000002','authenticated','authenticated','yard-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('yard-dispatch','40000000-0000-0000-0000-000000000001','YARD-DISP','Yard Dispatch','yard-dispatch@example.invalid','dispatcher','dispatcher','{}','active','YD'),
  ('yard-driver','40000000-0000-0000-0000-000000000002','YARD-DRV','Yard Driver','yard-driver@example.invalid','driver','driver','{}','active','YV');
insert into public.customers(id,name) values ('yard-cust','Duneville Builder');
insert into public.dumpsters(id,code,size) values ('can-a','T-A','20 Yard'), ('can-b','T-B','20 Yard'), ('can-c','T-C','20 Yard');
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_driver_id,assigned_dumpster_id,scheduled_for) values
  ('deliver-a','yard-cust','2283 Duneville Street','Delivery','20 Yard','yard-driver','can-a',now()),
  ('pickup-wrong-can','yard-cust','2283 duneville street ','Pick-Up','20 Yard','yard-driver','can-b',now()),
  ('deliver-a-again','yard-cust','2283 Duneville Street','Delivery','20 Yard','yard-driver','can-a',now()),
  ('pickup-a','yard-cust','2283 Duneville Street','Pick-Up','20 Yard','yard-driver','can-a',now()),
  ('deliver-oak-wrong','yard-cust','9 Oak Ln','Delivery','20 Yard','yard-driver','can-b',now()),
  ('swap-oak','yard-cust',' 9 OAK LN','Swap / Exchange','20 Yard','yard-driver','can-b',now()),
  ('relocate-oak','yard-cust','10 Oak Ln','Relocation','20 Yard','yard-driver','can-b',now()),
  ('dump-return-oak','yard-cust','10 Oak Ln','Dump & Return','20 Yard','yard-driver','can-b',now()),
  ('deliver-elm','yard-cust','20 Elm St','Delivery','20 Yard','yard-driver','can-a',now()),
  ('pickup-oak-wrong','yard-cust','10 Oak Ln','Pick-Up','20 Yard','yard-driver','can-a',now()),
  ('dry-run-c','yard-cust','30 Pine St','Delivery','20 Yard','yard-driver','can-c',now());

-- Drives a job to arrived as the driver, then completes it as dispatch.
create function pg_temp.deliver(job text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('40000000-0000-0000-0000-000000000002');
  perform public.update_assigned_job_status(job, 'en_route');
  perform public.update_assigned_job_status(job, 'arrived');
  perform pg_temp.as_user('40000000-0000-0000-0000-000000000001');
  perform public.complete_job_as_dispatch(job, 'test override');
end;
$$;

set local role authenticated;

-- A completed delivery leaves the can out at the site, not back in the yard.
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select public.set_job_pickup_plan('deliver-a','2026-10-07 15:00+00');
select pg_temp.deliver('deliver-a');
select is((select status::text from public.dumpsters where id='can-a'),'out','a delivered can stays out');
select is((select current_location from public.dumpsters where id='can-a'),'2283 Duneville Street','a delivered can shows the jobsite');
select is((select count(*) from public.container_placements where dumpster_id='can-a' and retrieved_at is null),1::bigint,'the delivery opens a placement');
select is((select pickup_status from public.container_placements where delivered_job_id='deliver-a'),'scheduled','a pickup date booked with the job reaches the rental');

-- The pick-up names the wrong can. The one actually on site still comes home.
select lives_ok($$select pg_temp.deliver('pickup-wrong-can')$$,'a pick-up naming a yard can completes');
select is((select retrieved_job_id from public.container_placements where dumpster_id='can-a' and delivered_job_id='deliver-a'),'pickup-wrong-can','the only can at that site is retrieved by the pick-up');
select is((select status::text from public.dumpsters where id='can-a'),'in_yard','the retrieved can is in the yard');
select is((select current_job_id from public.dumpsters where id='can-a'),null,'the retrieved can holds no job');
select is((select status::text from public.dumpsters where id='can-b'),'in_yard','the wrongly named can is in the yard too');

-- A can out on a rental can be sent on its own pick-up, and cancelling that
-- pick-up does not pretend it came home.
select pg_temp.deliver('deliver-a-again');
select pg_temp.as_user('40000000-0000-0000-0000-000000000002');
select lives_ok($$select public.update_assigned_job_status('pickup-a','en_route')$$,'a can on rental can start its pick-up');
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select lives_ok($$select public.cancel_job('pickup-a','customer not ready')$$,'the pick-up can be cancelled');
select is((select status::text from public.dumpsters where id='can-a'),'out','a cancelled pick-up leaves the can out');
select is((select current_location from public.dumpsters where id='can-a'),'2283 Duneville Street','a cancelled pick-up leaves the can at the site');
select is((select current_job_id from public.dumpsters where id='can-a'),'deliver-a-again','the can points back at its rental');

-- Dispatch marks it In Yard by hand; the rental ends with it.
update public.dumpsters set status='in_yard', current_location='Yard' where id='can-a';
select is((select count(*) from public.container_placements where dumpster_id='can-a' and retrieved_at is null),0::bigint,'a manual In Yard ends the open placement');
select is((select current_job_id from public.dumpsters where id='can-a'),null,'a manual In Yard releases the rental job');
select is((select current_customer_id from public.dumpsters where id='can-a'),null,'a manual In Yard clears the customer');

-- The wrong can was recorded on a delivery (can-b named, can-a dropped).
-- Correct Assignment moves the rental and both cans.
select pg_temp.deliver('deliver-oak-wrong');
update public.dumpsters set status='in_yard', current_location='Yard' where id='can-a' and status<>'in_yard';
select lives_ok($$select public.correct_completed_job('deliver-oak-wrong','can-a','wrong can recorded')$$,'a completed delivery can be corrected');
select is((select dumpster_id from public.container_placements where delivered_job_id='deliver-oak-wrong'),'can-a','the rental moves to the corrected can');
select is((select current_location from public.dumpsters where id='can-a'),'9 Oak Ln','the corrected can is out at the site');
select is((select status::text from public.dumpsters where id='can-b'),'in_yard','the wrongly named can is home');

-- A swap typed with different case and spacing still takes the full can away.
select pg_temp.deliver('swap-oak');
select is((select retrieved_job_id from public.container_placements where delivered_job_id='deliver-oak-wrong'),'swap-oak','the swap retrieves the can at that site');
select is((select status::text from public.dumpsters where id='can-a'),'in_yard','the departing can is home');
select is((select current_location from public.dumpsters where id='can-b'),' 9 OAK LN','the arriving can is at the site');

-- Relocation moves the rental; dump & return leaves the can where it is.
select pg_temp.deliver('relocate-oak');
select is((select address from public.container_placements where dumpster_id='can-b' and retrieved_at is null),'10 Oak Ln','a relocation moves the rental');
select is((select current_location from public.dumpsters where id='can-b'),'10 Oak Ln','a relocation moves the can');
select pg_temp.deliver('dump-return-oak');
select is((select status::text from public.dumpsters where id='can-b'),'out','a dump and return leaves the can out');
select is((select current_location from public.dumpsters where id='can-b'),'10 Oak Ln','a dump and return leaves the can at the site');
select is((select count(*) from public.container_placements where dumpster_id='can-b' and retrieved_at is null),1::bigint,'a dump and return keeps the rental open');

-- A pick-up recorded against the wrong can (can-a, out at Elm) closed that
-- rental. Correcting it to can-b reopens Elm and closes Oak.
select pg_temp.deliver('deliver-elm');
select pg_temp.deliver('pickup-oak-wrong');
select is((select status::text from public.dumpsters where id='can-a'),'in_yard','precondition: the wrong can was brought home');
select lives_ok($$select public.correct_completed_job('pickup-oak-wrong','can-b','wrong can recorded')$$,'a completed pick-up can be corrected');
select is((select count(*) from public.container_placements where dumpster_id='can-a' and retrieved_at is null and address='20 Elm St'),1::bigint,'the wrongly closed rental is reopened');
select is((select current_location from public.dumpsters where id='can-a'),'20 Elm St','the wrongly returned can is back at its site');
select is((select retrieved_job_id from public.container_placements where dumpster_id='can-b' and delivered_job_id='swap-oak'),'pickup-oak-wrong','the corrected can is retrieved by the pick-up');
select is((select status::text from public.dumpsters where id='can-b'),'in_yard','the corrected can is home');

-- A delivery that turns into a dry run sends its can home.
select pg_temp.as_user('40000000-0000-0000-0000-000000000002');
select public.update_assigned_job_status('dry-run-c','en_route');
select lives_ok($$select public.log_assigned_job_dry_run('dry-run-c','nobody on site')$$,'the driver can log a dry run');
select is((select status::text from public.dumpsters where id='can-c'),'in_yard','a dry-run delivery sends the can home');

reset role;
select * from finish();
rollback;
