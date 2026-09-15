-- Dispatch needs to discard test or mistaken drafts without weakening the
-- immutable Stripe invoice ledger. Deletion is therefore transactional and
-- limited to drafts that have never acquired a Stripe invoice id.
create function public.delete_invoice_draft(target_invoice_id text)
returns text language plpgsql security definer set search_path='' as $$
declare saved public.invoices;
begin
  if not public.has_permission('invoices') then
    raise exception 'Invoices permission required';
  end if;

  select * into saved from public.invoices
    where id=target_invoice_id for update;
  if saved.id is null then raise exception 'Invoice not found'; end if;
  if saved.id='training-v1-invoice' then
    raise exception 'Training data can only be removed from Settings';
  end if;
  if saved.status<>'draft' or saved.stripe_invoice_id is not null then
    raise exception 'Only unsent drafts can be deleted';
  end if;

  -- Restricting foreign keys protect finalized ledger history. Remove only
  -- the two draft-owned detail sets before removing the draft itself.
  delete from public.invoice_line_items where invoice_id=target_invoice_id;
  delete from public.invoice_jobs where invoice_id=target_invoice_id;
  delete from public.invoices where id=target_invoice_id;
  return target_invoice_id;
end;
$$;

revoke all on function public.delete_invoice_draft(text) from public,anon;
grant execute on function public.delete_invoice_draft(text) to authenticated;

-- "Big GC" described one customer, not a reusable customer type. Fold any
-- legacy values into Commercial, then keep the field to the customer types
-- dispatch actually uses.
update public.customers set customer_group='Commercial'
where customer_group='Big GC';
alter table public.customers drop constraint if exists customers_customer_group_check;
alter table public.customers add constraint customers_customer_group_check
  check(customer_group in ('Commercial','Residential','One-off'));
