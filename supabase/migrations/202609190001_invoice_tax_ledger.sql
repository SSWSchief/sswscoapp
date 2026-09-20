-- Keep the item subtotal and Stripe-calculated tax separately. `amount_cents`
-- remains the immutable sum of local line items; `tax_cents` is the tax shown
-- on the finalized Stripe invoice.
alter table public.invoices
  add column if not exists tax_cents bigint not null default 0
    check (tax_cents >= 0);

comment on column public.invoices.tax_cents is
  'Tax calculated by Stripe on the latest invoice snapshot, in cents.';
