begin;
select plan(30);

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
create function pg_temp.complete(job text, at timestamptz default '2026-09-15 18:00+00') returns void language plpgsql as $$
begin
  update public.jobs set status = 'en_route' where id = job;
  update public.jobs set status = 'arrived' where id = job;
  update public.jobs set status = 'complete' where id = job;
  insert into public.job_events(job_id, event_type, occurred_at) values (job, 'completed', at);
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
insert into public.trucks(id,number,type,status,mpg) values ('profit-truck','P-T1','Roll-off Truck','in_use',6.0);
insert into public.disposal_sites(id,name,rate_per_ton_cents) values ('profit-site','Test Landfill',6700);
insert into public.jobs(id,customer_id,address,service_type,dumpster_size,assigned_dumpster_id,assigned_truck_id,scheduled_for) values
  ('before-diesel','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','profit-truck','2026-09-15 15:00+00'),
  ('fuelled','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can','profit-truck','2026-09-15 15:00+00'),
  ('ticket-charged','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can',null,'2026-09-15 15:00+00'),
  ('ticket-rated','profit-cust','1 Penta Way','Pick-Up','20 Yard','profit-can',null,'2026-09-15 15:00+00'),
  ('august-job','profit-cust','1 Penta Way','Delivery','20 Yard','profit-can',null,'2026-08-31 15:00+00');

-- Labor starts at the $88 default; fuel waits for a diesel price.
select is((select count(*) from public.cost_defaults where labor_cents = 8800),4::bigint,'every size starts at $88 labor');
select pg_temp.complete('before-diesel');
select is((select labor_cents from public.job_costs where job_id='before-diesel'),8800::bigint,'a completed job takes the labor default');
select is((select labor_source::text from public.job_costs where job_id='before-diesel'),'estimated','a copied default is marked estimated');
select is((select mpg from public.job_costs where job_id='before-diesel'),6.0::numeric,'the truck mpg is copied at completion');
select is((select diesel_cents_per_gallon from public.job_costs where job_id='before-diesel'),null,'no diesel price means no fuel figure yet');

-- With a diesel price set, fuel follows the miles.
update public.operating_costs set diesel_cents_per_gallon = 450;
update public.cost_defaults set dump_fee_cents = 26800 where dumpster_size = '20 Yard';
select pg_temp.complete('fuelled');
update public.job_costs set route_miles = 24 where job_id = 'fuelled';
update public.operating_costs set diesel_cents_per_gallon = 500;
update public.trucks set mpg = 8 where id = 'profit-truck';
update public.cost_defaults set labor_cents = 9500;

-- Revenue on an invoice half paid, and on one not yet issued.
insert into public.invoices(id,invoice_number,customer_id,amount_cents) values
  ('inv-open','T-1','profit-cust',0),('inv-draft','T-2','profit-cust',0),('inv-late','T-3','profit-cust',0);
insert into public.invoice_line_items(invoice_id,description,amount_cents,position,job_id,category) values
  ('inv-open','20 yd rental',47500,0,'fuelled','rental'),
  ('inv-open','Delivery',15000,1,'fuelled','fee'),
  ('inv-draft','Not yet issued',99900,0,'before-diesel','rental'),
  ('inv-late','Billed in September',40000,0,'august-job','rental');
update public.invoices set status='open', issued_at='2026-09-16 17:00+00', amount_paid_cents=31250 where id='inv-open';
update public.invoices set status='paid', issued_at='2026-09-02 17:00+00', amount_paid_cents=40000 where id='inv-late';
select pg_temp.complete('august-job', '2026-08-31 18:00+00');

-- Dump fee sources: a ticket charge, then tons at the site's rate.
select pg_temp.complete('ticket-charged');
insert into public.disposal_tickets(job_id,net_weight_lbs,disposal_fee_cents) values ('ticket-charged',8000,31250);
select pg_temp.complete('ticket-rated');
insert into public.disposal_tickets(job_id,net_weight_lbs,disposal_site_id) values ('ticket-rated',6000,'profit-site');

select pg_temp.as_user('50000000-0000-0000-0000-000000000001');
set local role authenticated;
create temporary table report as select * from public.profitability_rows('2026-09-01','2026-09-30');

select is((select count(*) from report),5::bigint,'the report lists jobs completed or invoiced in range');
select is((select invoiced from report where job_id='august-job'),true,'a job completed in August but invoiced in September is included');
select is((select fuel_cents from report where job_id='fuelled'),1800::bigint,'fuel is miles / mpg x diesel, at the prices on the day');
select is((select fuel_source::text from report where job_id='fuelled'),'estimated','calculated fuel is estimated');
select is((select labor_cents from report where job_id='fuelled'),8800::bigint,'a later labor default does not rewrite a completed job');
select is((select fuel_cents from report where job_id='before-diesel'),null,'no miles or diesel leaves fuel empty');
select is((select revenue_cents from report where job_id='fuelled'),62500::bigint,'revenue sums the issued invoice lines');
select is((select received_cents from report where job_id='fuelled'),31250::bigint,'received is the paid share of an open invoice');
select is((select received_cents from report where job_id='august-job'),40000::bigint,'a paid invoice is received in full');
select is((select invoiced from report where job_id='before-diesel'),false,'a draft invoice does not count as revenue');
select is((select dump_fee_cents from report where job_id='fuelled'),26800::bigint,'with no ticket the size default is the dump fee');
select is((select dump_source::text from report where job_id='fuelled'),'estimated','a default dump fee is estimated');
select is((select dump_fee_cents from report where job_id='ticket-charged'),31250::bigint,'a ticket charge is the dump fee');
select is((select dump_source::text from report where job_id='ticket-charged'),'actual','a ticket charge is actual');
select is((select dump_fee_cents from report where job_id='ticket-rated'),20100::bigint,'without a charge, tons times the site rate is the dump fee');

update public.job_costs set dump_fee_override_cents=40000, fuel_override_cents=2500 where job_id='fuelled';
select is((select dump_fee_cents from public.profitability_rows('2026-09-01','2026-09-30') where job_id='fuelled'),40000::bigint,'an admin dump fee beats every derived one');
select is((select fuel_cents from public.profitability_rows('2026-09-01','2026-09-30') where job_id='fuelled'),2500::bigint,'an admin fuel figure beats the calculation');
select is((select fuel_source::text from public.profitability_rows('2026-09-01','2026-09-30') where job_id='fuelled'),'actual','an admin fuel figure is actual');
select is((select count(*) from public.profitability_rows('2026-10-01','2026-10-31')),0::bigint,'jobs outside the range are left out');
select is(pg_temp.sqlstate_of($$insert into public.operating_costs(id) values (true)$$),'42501','the settings row cannot be duplicated');

-- Nobody else sees costs or profit.
select pg_temp.as_user('50000000-0000-0000-0000-000000000002');
select is(pg_temp.sqlstate_of($$select * from public.profitability_rows('2026-09-01','2026-09-30')$$),'P0001','dispatch cannot run the profitability report');
select is((select count(*) from public.job_costs),0::bigint,'dispatch cannot read job costs');
select is((select count(*) from public.operating_costs),0::bigint,'dispatch cannot read the diesel price');
select is(pg_temp.sqlstate_of($$insert into public.cost_defaults(dumpster_size) values ('40 Yard')$$),'42501','dispatch cannot set cost defaults');
select pg_temp.as_user('50000000-0000-0000-0000-000000000003');
select is((select count(*) from public.cost_defaults),0::bigint,'a driver cannot read cost defaults');

reset role;
select * from finish();
rollback;
