import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe/client";
import {
  ensureStripeCustomer,
  pushInvoiceToStripe,
} from "@/lib/stripe/invoice-push";

const route = "/api/invoices/[id]/send";

/**
 * Push an invoice to Stripe and send it to the customer.
 *
 * Authorised by row level security rather than a role check: `invoices_read`
 * and `invoices_write` already gate the table on has_permission('invoices'),
 * so a caller without it simply cannot see the row, and the session client is
 * used throughout to keep that true.
 *
 * Safe to call twice. An invoice already pushed returns its existing payment
 * link rather than raising a second one — the guard is the stored Stripe id,
 * backed by idempotency keys inside the push itself.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "invoice_send_failed", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status,
      code,
    });
    return apiFailure(code, message, status, requestIdValue);
  };

  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return fail("unauthorized", "Unauthorized.", 401);

  const limited = await db.rpc("consume_api_rate_limit", {
    rate_bucket: "invoice:send",
    maximum_attempts: 60,
    window_seconds: 3600,
  });
  if (limited.error)
    return fail(
      "rate_limit_unavailable",
      "The request could not be safely processed.",
      503,
    );
  if (!limited.data)
    return fail("rate_limited", "Too many invoices sent. Try again later.", 429);

  const { id } = await params;
  const found = await db
    .from("invoices")
    .select(
      "id,invoice_number,customer_id,job_id,amount_cents,due_date,notes,po_number,stripe_invoice_id,hosted_invoice_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (found.error) return fail("lookup_failed", "Invoice lookup failed.", 500);
  if (!found.data) return fail("not_found", "Invoice not found.", 404);
  const invoice = found.data;

  if (invoice.stripe_invoice_id) {
    return apiSuccess(
      {
        alreadySent: true,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
      },
      requestIdValue,
    );
  }

  const customerRow = await db
    .from("customers")
    .select("id,name,email,phone,address,stripe_customer_id")
    .eq("id", invoice.customer_id as string)
    .maybeSingle();
  if (customerRow.error || !customerRow.data)
    return fail("customer_missing", "Customer could not be loaded.", 404);
  const customer = customerRow.data;

  // Stripe cannot deliver an invoice without somewhere to send it, and failing
  // here with the reason is far kinder than a Stripe error surfaced raw.
  if (!String(customer.email ?? "").trim())
    return fail(
      "customer_email_missing",
      `${customer.name} has no email address, so Stripe cannot deliver the invoice. Add one on the customer record first.`,
      409,
    );

  let jobReference: string | null = null;
  if (invoice.job_id) {
    const job = await db
      .from("jobs")
      .select("reference")
      .eq("id", invoice.job_id as string)
      .maybeSingle();
    jobReference = (job.data?.reference as string | undefined) ?? null;
  }

  let pushed;
  let stripeCustomerId: string;
  try {
    const stripe = createStripeClient();
    stripeCustomerId = await ensureStripeCustomer(stripe, {
      id: customer.id as string,
      name: customer.name as string,
      email: customer.email as string,
      phone: (customer.phone as string) ?? "",
      address: (customer.address as string) ?? "",
      stripeCustomerId: (customer.stripe_customer_id as string | null) ?? null,
    });
    pushed = await pushInvoiceToStripe(
      stripe,
      {
        id: invoice.id as string,
        invoiceNumber: invoice.invoice_number as string,
        amountCents: Number(invoice.amount_cents),
        dueDate: invoice.due_date as string,
        notes: (invoice.notes as string) ?? "",
        poNumber: (invoice.po_number as string) ?? "",
        jobReference,
      },
      stripeCustomerId,
    );
  } catch (error) {
    // Stripe's own message is the useful one here — "customer has no payment
    // method", "invoice number already in use" — so it is passed through
    // rather than replaced with something vaguer.
    return fail(
      "stripe_failed",
      error instanceof Error
        ? error.message
        : "Stripe could not raise this invoice.",
      502,
    );
  }

  if (!customer.stripe_customer_id) {
    await db
      .from("customers")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", customer.id as string);
  }

  const saved = await db
    .from("invoices")
    .update({
      stripe_invoice_id: pushed.stripeInvoiceId,
      hosted_invoice_url: pushed.hostedInvoiceUrl,
      invoice_pdf_url: pushed.invoicePdfUrl,
      status: "sent",
    })
    .eq("id", invoice.id as string);
  // The invoice is already out; losing the link locally is bad but not worth
  // failing the request over, and the webhook will fill the rest back in.
  if (saved.error)
    logRequest("error", "invoice_send_not_recorded", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 200,
      code: "record_failed",
      detail: { stripeInvoiceId: pushed.stripeInvoiceId },
    });

  logRequest("info", "invoice_sent", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
    detail: { stripeInvoiceId: pushed.stripeInvoiceId },
  });
  return apiSuccess(
    { alreadySent: false, hostedInvoiceUrl: pushed.hostedInvoiceUrl },
    requestIdValue,
  );
}
