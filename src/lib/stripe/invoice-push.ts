import "server-only";
import type Stripe from "stripe";

interface PushableCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  stripeCustomerId: string | null;
}

interface PushableInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  dueDate: string;
  notes: string;
  poNumber: string;
  jobReference: string | null;
  /** Rental terms and prohibited materials, printed on the invoice. */
  terms: string;
}

interface PushedInvoice {
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  status: string;
}

/**
 * The Stripe Customer for one of ours, created on first use.
 *
 * Idempotent on our own customer id, so a retry after a network failure
 * reuses the customer Stripe already made rather than creating a duplicate
 * that would split the account's billing history in two.
 */
export async function ensureStripeCustomer(
  stripe: Stripe,
  customer: PushableCustomer,
): Promise<string> {
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const created = await stripe.customers.create(
    {
      name: customer.name,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      address: customer.address ? { line1: customer.address } : undefined,
      metadata: { sswsco_customer_id: customer.id },
    },
    { idempotencyKey: `customer:${customer.id}` },
  );
  return created.id;
}

/**
 * Push one invoice to Stripe and send it.
 *
 * Three calls rather than one because Stripe models the lifecycle that way: a
 * draft is assembled, finalising freezes it and mints the PDF, and sending
 * mails it. We finalise explicitly rather than letting it happen on send, so
 * the hosted URL and PDF exist even if delivery later fails.
 *
 * `collection_method: send_invoice` is what makes this an invoice with terms
 * rather than an immediate charge — the customer receives a payment page and
 * pays by ACH or card on their own time, which is how the GC work is billed.
 *
 * Every call is keyed on our own invoice id, so a retry cannot bill twice.
 */
export async function pushInvoiceToStripe(
  stripe: Stripe,
  invoice: PushableInvoice,
  stripeCustomerId: string,
): Promise<PushedInvoice> {
  const key = `invoice:${invoice.id}`;

  // Stripe wants seconds, and refuses a due date in the past on a sent
  // invoice. A back-dated due date means the office is invoicing late, which
  // is not an error worth blocking on — it becomes due immediately.
  const dueSeconds = Math.floor(Date.parse(`${invoice.dueDate}T23:59:59Z`) / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const dueDate = Number.isFinite(dueSeconds)
    ? Math.max(dueSeconds, nowSeconds + 3600)
    : nowSeconds + 86_400;

  const customFields: { name: string; value: string }[] = [];
  // A general contractor's accounts-payable department matches on their own PO
  // number, so it belongs on the face of the invoice rather than in a note.
  if (invoice.poNumber) {
    customFields.push({ name: "PO Number", value: invoice.poNumber });
  }
  if (invoice.jobReference) {
    customFields.push({ name: "Job", value: invoice.jobReference });
  }

  // Stripe prints the footer on the PDF but not on the hosted payment page —
  // verified against a real invoice, whose page text carries neither the terms
  // nor any link to them. A customer paying from the emailed link would
  // otherwise never know the terms existed, so the memo, which the page does
  // show, says where they are.
  const memo = [
    invoice.notes,
    invoice.terms
      ? "Rental terms and prohibited materials are on the invoice PDF."
      : "",
  ]
    .filter(Boolean)
    .join(" — ");

  const draft = await stripe.invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      due_date: dueDate,
      description: memo || undefined,
      // The office's own number, not Stripe's. Left to Stripe, the customer
      // receives an invoice numbered #XZHQCMWK-0001 that nobody at SSWS can
      // look up. Our invoice_number is already unique per account, which is
      // exactly what Stripe requires of this field.
      number: invoice.invoiceNumber,
      // The rental terms and the prohibited materials list travel with the
      // bill. Stripe prints the footer on both the hosted payment page and the
      // PDF, and finalising freezes it, so an invoice keeps the terms it was
      // issued under even after they are next edited.
      footer: invoice.terms || undefined,
      custom_fields: customFields.length ? customFields : undefined,
      metadata: {
        sswsco_invoice_id: invoice.id,
        sswsco_invoice_number: invoice.invoiceNumber,
      },
    },
    { idempotencyKey: `${key}:create` },
  );
  if (!draft.id) throw new Error("Stripe returned an invoice without an id.");

  await stripe.invoiceItems.create(
    {
      customer: stripeCustomerId,
      invoice: draft.id,
      amount: invoice.amountCents,
      currency: "usd",
      // One line for now. The rate card turns this into base, extra tonnage,
      // extra days, fees and the fuel surcharge as separate lines.
      description: invoice.jobReference
        ? `Roll-off service — job ${invoice.jobReference}`
        : "Roll-off service",
    },
    { idempotencyKey: `${key}:item` },
  );

  const finalized = await stripe.invoices.finalizeInvoice(draft.id, undefined, {
    idempotencyKey: `${key}:finalize`,
  });
  const sent = await stripe.invoices.sendInvoice(draft.id, undefined, {
    idempotencyKey: `${key}:send`,
  });

  return {
    stripeInvoiceId: draft.id,
    hostedInvoiceUrl: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
    invoicePdfUrl: sent.invoice_pdf ?? finalized.invoice_pdf ?? null,
    status: sent.status ?? finalized.status ?? "open",
  };
}
