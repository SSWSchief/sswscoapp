import "server-only";
import type Stripe from "stripe";
import type { InvoiceLineCategory, InvoicePaymentTerms } from "@/lib/types";

interface PushableCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: "US";
  };
  stripeCustomerId: string | null;
}

interface PushableInvoice {
  id: string;
  invoiceNumber: string;
  paymentTerms: InvoicePaymentTerms;
  notes: string;
  poNumber: string;
  terms: string;
  lineItems: Array<{
    id: string;
    description: string;
    amountCents: number;
    jobId: string | null;
    category: InvoiceLineCategory;
  }>;
}

/** Create or refresh the Stripe Customer from the reviewed billing snapshot. */
export async function syncStripeCustomer(
  stripe: Stripe,
  customer: PushableCustomer,
): Promise<string> {
  const details: Stripe.CustomerCreateParams = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone || undefined,
    address: {
      line1: customer.address.line1,
      line2: customer.address.line2 || undefined,
      city: customer.address.city,
      state: customer.address.state,
      postal_code: customer.address.postalCode,
      country: customer.address.country,
    },
    metadata: { sswsco_customer_id: customer.id },
  };
  if (customer.stripeCustomerId) {
    await stripe.customers.update(customer.stripeCustomerId, details);
    return customer.stripeCustomerId;
  }
  const created = await stripe.customers.create(details, {
    idempotencyKey: `customer:${customer.id}`,
  });
  return created.id;
}

const termsDays: Record<InvoicePaymentTerms, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
};

function invoiceMemo(invoice: PushableInvoice) {
  return [
    invoice.notes,
    invoice.terms
      ? "Rental terms and prohibited materials are on the invoice PDF."
      : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

/** Create the remote draft only. The caller persists its id before continuing. */
export async function createStripeInvoiceDraft(
  stripe: Stripe,
  invoice: PushableInvoice,
  stripeCustomerId: string,
  revisedStripeInvoiceId?: string | null,
) {
  const customFields: Stripe.InvoiceCreateParams.CustomField[] = [];
  if (invoice.poNumber)
    customFields.push({ name: "PO Number", value: invoice.poNumber });
  const common = {
    collection_method: "send_invoice" as const,
    days_until_due: termsDays[invoice.paymentTerms],
    description: invoiceMemo(invoice) || undefined,
    footer: invoice.terms || undefined,
    custom_fields: customFields.length ? customFields : undefined,
    payment_settings: {
      payment_method_types: ["card", "us_bank_account"] as Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[],
    },
    metadata: {
      sswsco_invoice_id: invoice.id,
      sswsco_invoice_number: invoice.invoiceNumber,
    },
  };
  return stripe.invoices.create(
    revisedStripeInvoiceId
      ? {
          ...common,
          // The revision carries its own local number, and it has to travel
          // with it. Stripe would otherwise assign a number of its own, and
          // the office would be chasing a payment under a number that appears
          // nowhere in this ledger.
          number: invoice.invoiceNumber,
          from_invoice: { invoice: revisedStripeInvoiceId, action: "revision" },
        }
      : { ...common, customer: stripeCustomerId, number: invoice.invoiceNumber },
    { idempotencyKey: `invoice:${invoice.id}:create` },
  );
}

/** Recover a remote draft whose id could not be persisted locally. */
export async function findStripeInvoiceByLocalMetadata(
  stripe: Stripe,
  invoice: Pick<PushableInvoice, "id" | "invoiceNumber" | "lineItems">,
) {
  const matches = await stripe.invoices.search({
    query: `metadata['sswsco_invoice_id']:'${invoice.id}'`,
    limit: 10,
  });
  const trusted = matches.data.filter(
    (candidate) =>
      candidate.metadata?.sswsco_invoice_id === invoice.id &&
      candidate.metadata?.sswsco_invoice_number === invoice.invoiceNumber &&
      candidate.currency === "usd" &&
      candidate.status !== "void",
  );
  if (trusted.length > 1)
    throw new Error("Multiple Stripe invoices match this local draft. Reconcile before retrying.");
  const recovered = trusted[0];
  const expectedAmount = invoice.lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  if (recovered && recovered.status !== "draft" && recovered.amount_due !== expectedAmount)
    throw new Error("The recovered Stripe invoice amount does not match this draft. Reconcile before retrying.");
  return recovered ?? null;
}

/** Replace any cloned revision lines, then write the app's immutable snapshot. */
export async function replaceStripeInvoiceItems(
  stripe: Stripe,
  invoice: PushableInvoice,
  stripeCustomerId: string,
  stripeInvoiceId: string,
) {
  // Paginated deliberately. A revision is cloned from the original with all of
  // its lines, and a statement may carry a hundred of its own, so a single
  // page is not guaranteed to hold them. A line left undeleted here would be
  // billed to the customer a second time.
  for await (const line of stripe.invoices.listLineItems(stripeInvoiceId, {
    limit: 100,
  })) {
    const invoiceItemId = line.parent?.invoice_item_details?.invoice_item;
    if (invoiceItemId)
      await stripe.invoiceItems.del(invoiceItemId, {
        idempotencyKey: `invoice:${invoice.id}:delete:${invoiceItemId}`,
      });
  }
  for (const item of invoice.lineItems) {
    await stripe.invoiceItems.create(
      {
        customer: stripeCustomerId,
        invoice: stripeInvoiceId,
        amount: item.amountCents,
        currency: "usd",
        description: item.description,
        metadata: {
          sswsco_line_item_id: item.id,
          sswsco_category: item.category,
          ...(item.jobId ? { sswsco_job_id: item.jobId } : {}),
        },
      },
      { idempotencyKey: `invoice:${invoice.id}:item:${item.id}` },
    );
  }
}

export async function finalizeAndSendStripeInvoice(
  stripe: Stripe,
  localInvoiceId: string,
  stripeInvoiceId: string,
) {
  const finalized = await stripe.invoices.finalizeInvoice(
    stripeInvoiceId,
    undefined,
    { idempotencyKey: `invoice:${localInvoiceId}:finalize` },
  );
  const sent = await stripe.invoices.sendInvoice(stripeInvoiceId, undefined, {
    idempotencyKey: `invoice:${localInvoiceId}:send`,
  });
  return {
    invoice: sent,
    hostedInvoiceUrl:
      sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
    invoicePdfUrl: sent.invoice_pdf ?? finalized.invoice_pdf ?? null,
  };
}

export async function resendStripeInvoice(
  stripe: Stripe,
  localInvoiceId: string,
  stripeInvoiceId: string,
) {
  return stripe.invoices.sendInvoice(stripeInvoiceId, undefined, {
    idempotencyKey: `invoice:${localInvoiceId}:resend:${Date.now()}`,
  });
}
