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

/**
 * The Stripe tax rate for `percent`, reusing `existingId` while it still says
 * exactly that. Stripe never lets a rate's percentage change, so a new rate
 * means a new object; the caller saves whichever id comes back.
 */
export async function ensureSalesTaxRate(
  stripe: Stripe,
  percent: number,
  existingId: string | null,
): Promise<string> {
  if (existingId) {
    const existing = await stripe.taxRates.retrieve(existingId).catch(() => null);
    if (existing?.active && !existing.inclusive && Number(existing.percentage) === percent)
      return existing.id;
  }
  const created = await stripe.taxRates.create(
    {
      display_name: "Sales Tax",
      description: "Nevada sales tax, Clark County",
      percentage: percent,
      inclusive: false,
      country: "US",
      state: "NV",
      jurisdiction: "Clark County, NV",
      tax_type: "sales_tax",
      metadata: { sswsco_sales_tax_rate: String(percent) },
    },
    { idempotencyKey: `sales-tax-rate:NV:${percent}` },
  );
  return created.id;
}

/**
 * Sales tax is a fixed Nevada rate on the whole invoice, never Stripe's
 * automatic tax: that classified every line as a general service, which
 * Nevada does not tax, and charged 0%. An empty list means no tax.
 */
function salesTaxSettings(taxRateIds: string[]) {
  return {
    automatic_tax: { enabled: false },
    ...(taxRateIds.length ? { default_tax_rates: taxRateIds } : {}),
  };
}

/** Create the remote draft only. The caller persists its id before continuing. */
export async function createStripeInvoiceDraft(
  stripe: Stripe,
  invoice: PushableInvoice,
  stripeCustomerId: string,
  revisedStripeInvoiceId: string | null,
  taxRateIds: string[],
) {
  const customFields: Stripe.InvoiceCreateParams.CustomField[] = [];
  if (invoice.poNumber)
    customFields.push({ name: "PO Number", value: invoice.poNumber });
  const common = {
    collection_method: "send_invoice" as const,
    ...salesTaxSettings(taxRateIds),
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

/**
 * Put the draft on the current tax settings before its lines are written. A
 * draft recovered from an earlier attempt, or a revision cloned from an
 * original, may still carry automatic tax or an older rate. Stripe clears a
 * list given as an empty string.
 */
export async function applyStripeInvoiceTax(
  stripe: Stripe,
  localInvoiceId: string,
  stripeInvoiceId: string,
  taxRateIds: string[],
) {
  return stripe.invoices.update(
    stripeInvoiceId,
    {
      automatic_tax: { enabled: false },
      default_tax_rates: taxRateIds.length ? taxRateIds : "",
    },
    { idempotencyKey: `invoice:${localInvoiceId}:tax:${taxRateIds.join(",") || "none"}` },
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
  // Compared before tax: the lines are the local record, and the amount due
  // also carries whatever tax Stripe added on top of them.
  const expectedAmount = invoice.lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  if (recovered && recovered.status !== "draft" && recovered.subtotal !== expectedAmount)
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
