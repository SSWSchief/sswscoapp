-- Stripe becomes the delivery and payment rail; this database stays the ledger.
--
-- Invoices are composed here, pushed to Stripe once, and never edited on the
-- Stripe side. Money events come back by webhook and move `status` through the
-- enum it already has. These columns are the join between the two systems and
-- carry no pricing of their own, so none of this waits on the rate card.
--
-- Note on delivery: the app has no working outbound email
-- (NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED is off, SMTP was never configured) and
-- customers are records rather than users, so an invoice created today has
-- nowhere to go. Stripe hosts the payment page and sends the mail, which is
-- most of why it was chosen over generating a PDF here.

alter table public.customers
  add column if not exists stripe_customer_id text;

comment on column public.customers.stripe_customer_id is
  'Stripe Customer this record maps to, created lazily the first time they are invoiced. Null means never billed through Stripe.';

-- One Stripe customer per record and vice versa. Partial, so the many rows
-- that have never been invoiced do not collide on null.
create unique index if not exists customers_stripe_customer_idx
  on public.customers (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.invoices
  add column if not exists stripe_invoice_id text,
  add column if not exists hosted_invoice_url text,
  add column if not exists invoice_pdf_url text,
  add column if not exists amount_paid_cents bigint not null default 0,
  -- General contractors' accounts-payable departments commonly reject an
  -- invoice that does not carry their purchase order number. Cheap to hold
  -- now, expensive to add once invoices are going out.
  add column if not exists po_number text not null default '';

alter table public.invoices
  drop constraint if exists invoices_amount_paid_check;
alter table public.invoices
  add constraint invoices_amount_paid_check check (amount_paid_cents >= 0);

comment on column public.invoices.stripe_invoice_id is
  'The Stripe Invoice this was pushed to. Set once at creation and never reused; the webhook matches incoming events on it.';
comment on column public.invoices.hosted_invoice_url is
  'Stripe-hosted payment page for the customer. Branded from the Stripe dashboard, not from this application.';
comment on column public.invoices.amount_paid_cents is
  'Settled amount as reported by Stripe, which may be less than amount_cents while a partial payment is outstanding.';

create unique index if not exists invoices_stripe_invoice_idx
  on public.invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- No separate lookup index: the unique index above already covers the only
-- read path that matters, which is the webhook arriving with a Stripe id and
-- nothing else.
