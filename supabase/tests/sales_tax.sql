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

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','60000000-0000-0000-0000-000000000001','authenticated','authenticated','tax-admin@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','60000000-0000-0000-0000-000000000002','authenticated','authenticated','tax-dispatch@example.invalid','',now(),'{}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','60000000-0000-0000-0000-000000000003','authenticated','authenticated','tax-driver@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('tax-admin','60000000-0000-0000-0000-000000000001','TAX-ADM','Tax Admin','tax-admin@example.invalid','management','admin','{}','active','TA'),
  ('tax-dispatch','60000000-0000-0000-0000-000000000002','TAX-DSP','Tax Dispatch','tax-dispatch@example.invalid','dispatcher','dispatcher','{}','active','TD'),
  ('tax-driver','60000000-0000-0000-0000-000000000003','TAX-DRV','Tax Driver','tax-driver@example.invalid','driver','driver','{}','active','TV');
insert into public.customers(id,name) values ('tax-cust','Penta');

-- The fixed rate and the policy that replaces automatic tax.
select is((select sales_tax_rate from public.company_settings), 8.375::numeric, 'every line is taxed at 8.375% by default');
select is(
  pg_temp.sqlstate_of($$update public.company_settings set tax_policy_status = 'automatic_tax_approved'$$),
  '23514', 'automatic tax is no longer a policy');
select is(
  pg_temp.sqlstate_of($$update public.company_settings set tax_policy_status = 'fixed_rate_approved'$$),
  null, 'fixed-rate tax is the approved policy');

-- A $400 rental taxed at 8.375% ($433.50), paid in two parts.
insert into public.invoices(id,invoice_number,customer_id,amount_cents) values
  ('taxed','T-100','tax-cust',40000),
  ('before-tax','T-099','tax-cust',40000),
  ('late-night','T-098','tax-cust',40000);
update public.invoices set status='open', issued_at='2026-10-05 17:00+00', tax_cents=3350, sales_tax_rate=8.375 where id='taxed';
select is((select count(*) from public.invoice_payments where invoice_id='taxed'), 0::bigint, 'nothing is received until Stripe says so');
select is(
  pg_temp.sqlstate_of($$update public.invoices set sales_tax_rate = 30 where id = 'taxed'$$),
  '23514', 'an invoice cannot record an impossible rate');

update public.invoices set amount_paid_cents = 20000 where id = 'taxed';
update public.invoice_payments set received_at = '2026-10-10 18:00+00' where invoice_id = 'taxed';
select is((select sum(amount_cents) from public.invoice_payments where invoice_id='taxed'), 20000::numeric, 'a part payment is one receipt');

update public.invoices set amount_paid_cents = 20000 where id = 'taxed';
select is((select count(*) from public.invoice_payments where invoice_id='taxed'), 1::bigint, 'syncing the same total again records nothing');

update public.invoices set status='paid', amount_paid_cents=43350, paid_at='2026-11-02 19:00+00' where id='taxed';
select is((select amount_cents from public.invoice_payments where invoice_id='taxed' order by received_at desc limit 1), 23350::bigint, 'settling it records only the balance');
select is((select received_at from public.invoice_payments where invoice_id='taxed' order by received_at desc limit 1), '2026-11-02 19:00+00'::timestamptz, 'the settling receipt is dated when Stripe says it was paid');

-- Sent before fixed-rate tax: no tax, no rate.
update public.invoices set status='paid', issued_at='2026-10-01 15:00+00', amount_paid_cents=40000, paid_at='2026-10-02 17:45+00' where id='before-tax';
-- Paid at 10:30 PM on September 30 in Las Vegas, which is October 1 in UTC.
update public.invoices set status='paid', issued_at='2026-09-30 15:00+00', amount_paid_cents=40000, paid_at='2026-10-01 05:30+00' where id='late-night';

select pg_temp.as_user('60000000-0000-0000-0000-000000000001');
set local role authenticated;
create temporary table q4 as select * from public.sales_tax_rows('2026-10-01','2026-12-31');
create temporary table q3 as select * from public.sales_tax_rows('2026-07-01','2026-09-30');

select is((select count(*) from q4), 3::bigint, 'the quarter lists each payment received in it');
select is((select sum(tax_cents) from q4 where invoice_id='taxed'), 3350::numeric, 'part payments carry exactly the invoice''s tax between them');
select is((select sum(sale_cents) from q4 where invoice_id='taxed'), 40000::numeric, 'and exactly its sales');
select is((select tax_cents from q4 where invoice_id='taxed' order by received_at limit 1), 1546::bigint, 'each part carries tax in proportion');
select is((select untaxed_cents from q4 where invoice_id='before-tax'), 3350::bigint, 'tax an older invoice never collected is shown at today''s rate');
select is((select tax_rate from q4 where invoice_id='before-tax'), null, 'an older invoice shows no rate');
select is((select invoice_id from q3), 'late-night', 'a payment counts on its Las Vegas date');
select is((select count(*) from public.invoice_payments), 4::bigint, 'management can read the ledger');
reset role;

select pg_temp.as_user('60000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(pg_temp.sqlstate_of($$select * from public.sales_tax_rows('2026-10-01','2026-12-31')$$), 'P0001', 'dispatch cannot run the tax return without invoices access');
reset role;

select pg_temp.as_user('60000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((select count(*) from public.invoice_payments), 0::bigint, 'drivers see no payments');
reset role;

select * from finish();
rollback;
