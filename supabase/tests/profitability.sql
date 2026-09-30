begin;
select plan(19);

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
-- Walks a job to complete as the completion RPCs do, stamping the event the
-- report dates it by.
create function pg_temp.complete(job text) returns void language plpgsql as $$
begin
  update public.jobs set status = 'en_route' where id = job;
  update public.jobs set status = 'arrived' where id = job;
  update public.jobs set status = 'complete' where id = job;
  insert into public.job_events(job_id, event_type, occurred_at) values (job, 'completed', '2026-09-15 18:00+00');
end;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000001','authenticated','authenticated','profit-admin@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000002','authenticated','authenticated','profit-dispatch@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','50000000-0000-0000-0000-000000000003','authenticated','authenticated','profit-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('profit-admin','50000000-0000-0000-0000-000000000001','PROFIT-ADM','Profit Admin','profit-admin@example.invalid','management','admin','{}','active','PA'),
  ('profit-dispatch','50000000-0000-0000-0000-000000000002','PROFIT-DSP','Profit Dispatch','profit-dispatch@example.invalid','dispatcher','dispatcher','{}','active','PD'),
  ('profit-driver','50000000-0000-0000-0000-000000000003','PROFIT-DRV','Profit Driver','profit-driver@example.invalid','driver','driver','{}','active','PV');
insert into public.customers(id,name) values ('profit-cust','Penta');
insert into public.dumpsters(id,code,size) values ('profit-can','P-20','20 Yard');
insert into public.disposal_sites(id,name,rate_per_ton_cents) values ('profit-site','Test Landfill',6700);
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_dumpster_id,scheduled_for) values
  ('before-defaults','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','2026-09-15 15:00+00'),
  ('with-defaults','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','2026-09-15 15:00+00'),
  ('ticket-charged','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','2026-09-15 15:00+00'),
  ('ticket-rated','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','2026-09-15 15:00+00');

-- With no defaults set, completion still opens an empty cost row.
select pg_temp.complete('before-defaults');
select is((select count(*) from public.job_costs where job_id='before-defaults'),1::bigint,'a completed job gets a cost row');
select is((select fuel_cents from public.job_costs where job_id='before-defaults'),null,'no default means no fuel figure');

-- Defaults are copied at completion and frozen there.
insert into public.cost_defaults(dumpster_size,fuel_cents,labor_cents,dump_fee_cents) values ('20 Yard',7500,8800,26800);
select pg_temp.complete('with-defaults');
select is((select fuel_cents from public.job_costs where job_id='with-defaults'),7500::bigint,'fuel is copied from the size default');
select is((select labor_source::text from public.job_costs where job_id='with-defaults'),'estimated','a copied default is marked estimated');
update public.cost_defaults set fuel_cents=15000 where dumpster_size='20 Yard';
select is((select fuel_cents from public.job_costs where job_id='with-defaults'),7500::bigint,'changing a default does not rewrite a completed job');

-- Revenue: pre-tax lines on issued invoices only.
insert into public.invoices(id,invoice_number,customer_id,amount_cents) values ('inv-open','T-1','profit-cust',0),('inv-draft','T-2','profit-cust',0);
insert into public.invoice_line_items(invoice_id,description,amount_cents,position,job_id,category) values
  ('inv-open','20 yd rental',47500,0,'with-defaults','rental'),
  ('inv-open','Delivery',15000,1,'with-defaults','fee'),
  ('inv-draft','Not yet issued',99900,0,'before-defaults','rental');
update public.invoices set status='open', issued_at='2026-09-16 17:00+00' where id='inv-open';

-- Dump fee sources: a ticket charge, then tons at the site's rate.
select pg_temp.complete('ticket-charged');
insert into public.disposal_tickets(job_id,net_weight_lbs,disposal_fee_cents) values ('ticket-charged',8000,31250);
select pg_temp.complete('ticket-rated');
insert into public.disposal_tickets(job_id,net_weight_lbs,disposal_site_id) values ('ticket-rated',6000,'profit-site');

select pg_temp.as_user('50000000-0000-0000-0000-000000000001');
set local role authenticated;
create temporary table report as select * from public.profitability_rows('2026-09-01','2026-09-30');

select is((select count(*) from report),4::bigint,'the report lists every job completed in range');
select is((select revenue_cents from report where job_id='with-defaults'),62500::bigint,'revenue sums the issued invoice lines');
select is((select invoiced from report where job_id='before-defaults'),false,'a draft invoice does not count as revenue');
select is((select dump_fee_cents from report where job_id='with-defaults'),26800::bigint,'with no ticket the size default is the dump fee');
select is((select dump_source::text from report where job_id='with-defaults'),'estimated','a default dump fee is estimated');
select is((select dump_fee_cents from report where job_id='ticket-charged'),31250::bigint,'a ticket charge is the dump fee');
select is((select dump_source::text from report where job_id='ticket-charged'),'actual','a ticket charge is actual');
select is((select dump_fee_cents from report where job_id='ticket-rated'),20100::bigint,'without a charge, tons times the site rate is the dump fee');

update public.job_costs set dump_fee_override_cents=40000 where job_id='ticket-rated';
select is((select dump_fee_cents from public.profitability_rows('2026-09-01','2026-09-30') where job_id='ticket-rated'),40000::bigint,'an admin override beats every derived dump fee');
select is((select count(*) from public.profitability_rows('2026-10-01','2026-10-31')),0::bigint,'jobs outside the range are left out');

-- Nobody else sees costs or profit.
select pg_temp.as_user('50000000-0000-0000-0000-000000000002');
select is(pg_temp.sqlstate_of($$select * from public.profitability_rows('2026-09-01','2026-09-30')$$),'P0001','dispatch cannot run the profitability report');
select is((select count(*) from public.job_costs),0::bigint,'dispatch cannot read job costs');
select is(pg_temp.sqlstate_of($$insert into public.cost_defaults(dumpster_size) values ('40 Yard')$$),'42501','dispatch cannot set cost defaults');
select pg_temp.as_user('50000000-0000-0000-0000-000000000003');
select is((select count(*) from public.cost_defaults),0::bigint,'a driver cannot read cost defaults');

reset role;
select * from finish();
rollback;
