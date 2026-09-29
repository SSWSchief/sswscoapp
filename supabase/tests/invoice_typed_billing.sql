begin;
select plan(20);

create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('00000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000001','authenticated','authenticated','billing-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.users(id,auth_user_id,employee_id,full_name,email,role,access_role,permission_overrides,status,initials) values
  ('billing-admin','30000000-0000-0000-0000-000000000001','BILL-ADMIN','Billing Admin','billing-admin@example.invalid','management','admin','{}','active','BA');
insert into public.customers(id,name,phone,email,billing_contact_name,billing_email,billing_address_line1,billing_city,billing_state,billing_postal_code,customer_group)
  values('billing-gc','Vegas GC','702-555-0100','dispatch@vegasgc.example','AP Desk','ap@vegasgc.example','1 Builder Way','Las Vegas','NV','89101','Commercial');

select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;

-- A new name typed on the invoice, with its billing details, and no profile.
create temporary table typed_new as
  select * from public.create_invoice_draft('{"customerId":"","customerName":"Maria Lopez","billingMode":"one_off","jobIds":[],"paymentTerms":"due_on_receipt","poNumber":"","notes":"","billing":{"contactName":"Maria Lopez","email":" Maria@Example.com ","phone":"702-555-0199","addressLine1":"42 Desert Rd","addressLine2":"","city":"Henderson","state":"nv","postalCode":"89002"},"items":[{"description":"10 yard cleanup","amountCents":35000,"category":"service","position":0}]}'::jsonb);
select is((select billing_email from typed_new),'maria@example.com','typed email is stored on the invoice, normalized');
select is((select billing_state from typed_new),'NV','typed state is upper-cased');
select is((select billing_city from typed_new),'Henderson','typed address is stored on the invoice');
select is((select customer_group from public.customers where id=(select customer_id from typed_new)),'One-off','an unknown name becomes a One-off customer');
select is((select billing_email from public.customers where id=(select customer_id from typed_new)),'maria@example.com','the new customer keeps the typed billing email');
select is((select phone from public.customers where id=(select customer_id from typed_new)),'702-555-0199','the new customer keeps the typed phone for texting');
select is((select count(*) from public.audit_log where entity_table='customers' and entity_id=(select customer_id from typed_new) and new_values->>'source'='invoice_form'),1::bigint,'the customer created from an invoice is audited');

-- The same person again, typed differently, reuses that customer.
create temporary table typed_again as
  select * from public.create_invoice_draft('{"customerId":"","customerName":"maria lopez","billingMode":"one_off","jobIds":[],"paymentTerms":"due_on_receipt","poNumber":"","notes":"","items":[{"description":"Second haul","amountCents":20000,"category":"service","position":0}]}'::jsonb);
select is((select customer_id from typed_again),(select customer_id from typed_new),'a matching name reuses the customer instead of creating another');
select is((select count(*) from public.customers where lower(name)='maria lopez'),1::bigint,'no duplicate customer for the same name');
select is((select billing_email from typed_again),'maria@example.com','without typed details the invoice copies the saved profile');

-- An existing customer billed to a different inbox, just this once.
create temporary table one_time_override as
  select * from public.create_invoice_draft('{"customerId":"billing-gc","billingMode":"one_off","jobIds":[],"paymentTerms":"net_30","poNumber":"","notes":"","billing":{"contactName":"Project Manager","email":"pm@vegasgc.example","phone":"","addressLine1":"1 Builder Way","addressLine2":"","city":"Las Vegas","state":"NV","postalCode":"89101"},"items":[{"description":"Change order","amountCents":10000,"category":"fee","position":0}]}'::jsonb);
select is((select billing_email from one_time_override),'pm@vegasgc.example','an override applies to the invoice');
select is((select billing_email from public.customers where id='billing-gc'),'ap@vegasgc.example','an override leaves the profile alone unless asked');

-- Editing that draft and choosing to save the details to the profile.
select is((public.update_invoice_draft((select id from one_time_override),'{"customerId":"billing-gc","billingMode":"one_off","jobIds":[],"paymentTerms":"net_30","poNumber":"","notes":"","saveBillingToCustomer":true,"billing":{"contactName":"New AP","email":"new-ap@vegasgc.example","phone":"702-555-0111","addressLine1":"9 Office Park","addressLine2":"Suite 4","city":"Las Vegas","state":"NV","postalCode":"89102-1234"},"items":[{"description":"Change order","amountCents":10000,"category":"fee","position":0}]}'::jsonb)).billing_email,'new-ap@vegasgc.example','a draft edit takes the typed details');
select is((select billing_email from public.customers where id='billing-gc'),'new-ap@vegasgc.example','saving to the profile updates billing details');
select is((select phone from public.customers where id='billing-gc'),'702-555-0100','saving to the profile keeps the dispatch phone already on file');
select is((select email from public.customers where id='billing-gc'),'dispatch@vegasgc.example','saving to the profile keeps the dispatch email already on file');

select is(pg_temp.sqlstate_of($$select public.create_invoice_draft('{"customerId":"billing-gc","billingMode":"one_off","jobIds":[],"paymentTerms":"net_30","poNumber":"","notes":"","billing":{"contactName":"X","email":"not-an-email","phone":"","addressLine1":"","addressLine2":"","city":"","state":"","postalCode":""},"items":[{"description":"Fee","amountCents":100,"category":"fee","position":0}]}'::jsonb)$$),'P0001','an invalid billing email is refused');
select is(pg_temp.sqlstate_of($$select public.create_invoice_draft('{"customerId":"billing-gc","billingMode":"one_off","jobIds":[],"paymentTerms":"net_30","poNumber":"","notes":"","billing":{"contactName":"X","email":"","phone":"","addressLine1":"","addressLine2":"","city":"","state":"Nevada","postalCode":""},"items":[{"description":"Fee","amountCents":100,"category":"fee","position":0}]}'::jsonb)$$),'P0001','a state that is not a two-letter code is refused');
select is(pg_temp.sqlstate_of($$select public.create_invoice_draft('{"customerId":"","customerName":"  ","billingMode":"one_off","jobIds":[],"paymentTerms":"net_30","poNumber":"","notes":"","items":[{"description":"Fee","amountCents":100,"category":"fee","position":0}]}'::jsonb)$$),'P0001','an invoice needs a customer or a typed name');
select is(pg_temp.sqlstate_of($$select public.resolve_invoice_customer('{"customerName":"Direct Call"}'::jsonb)$$),'42501','the helper cannot be called directly');

reset role;
select * from finish();
rollback;
