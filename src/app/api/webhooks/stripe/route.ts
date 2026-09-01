import type Stripe from "stripe";
import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { webhookSigningSecret } from "@/lib/stripe/env";
import {
  invoiceStatusFromStripe,
  shouldApplyStatus,
  type StripeInvoiceStatus,
} from "@/lib/stripe/invoice-status";

const route = "/api/webhooks/stripe";

const HANDLED = [
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.marked_uncollectible",
  "invoice.voided",
  "invoice.sent",
];

/**
 * Money events coming back from Stripe.
 *
 * Deliberately outside the session-protected prefixes in middleware: Stripe
 * has no session, and the signature is the authentication. The service-role
 * client is used for the same reason — there is no user to attribute the write
 * to, and row level security would otherwise reject it.
 *
 * Every path is replay-safe. Stripe retries on any non-2xx and promises no
 * ordering, so an event arriving twice, or late, must not walk an invoice
 * backwards. Anything we cannot act on is acknowledged rather than refused,
 * because a non-2xx would have Stripe retry it indefinitely.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const secret = webhookSigningSecret();
  const signature = request.headers.get("stripe-signature");

  // A deployment that never received its signing secret is a configuration
  // fault on this side, not a malformed request, and must not be reported as
  // one: conflating the two makes a missing environment variable look exactly
  // like Stripe sending garbage. 500 also keeps Stripe retrying, so events
  // are not lost while the deployment is being fixed.
  if (!secret) {
    logRequest("error", "stripe_webhook_not_configured", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 500,
      code: "webhook_not_configured",
    });
    return apiFailure(
      "webhook_not_configured",
      "Stripe webhook secret is not configured for this deployment.",
      500,
      requestIdValue,
    );
  }

  if (!signature) {
    logRequest("warn", "stripe_webhook_unsigned", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 400,
      code: "missing_signature",
    });
    return apiFailure(
      "missing_signature",
      "Missing Stripe signature.",
      400,
      requestIdValue,
    );
  }

  // The raw body, byte for byte: any reserialisation invalidates the signature.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = createStripeClient().webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
  } catch {
    logRequest("warn", "stripe_webhook_rejected", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 400,
      code: "invalid_signature",
    });
    return apiFailure(
      "invalid_signature",
      "Signature verification failed.",
      400,
      requestIdValue,
    );
  }

  if (!HANDLED.includes(event.type)) {
    return apiSuccess({ ignored: event.type }, requestIdValue);
  }

  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.id) {
    return apiSuccess({ ignored: "invoice_without_id" }, requestIdValue);
  }

  const admin = createAdminClient();
  const existing = await admin
    .from("invoices")
    .select("id,status,due_date")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  if (existing.error) {
    logRequest("error", "stripe_webhook_lookup_failed", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 500,
      code: "lookup_failed",
    });
    return apiFailure(
      "lookup_failed",
      "Invoice lookup failed.",
      500,
      requestIdValue,
    );
  }

  // An invoice raised directly in the Stripe dashboard has no counterpart
  // here. Acknowledge it and say so in the logs rather than inventing a record
  // this system never issued.
  if (!existing.data) {
    logRequest("info", "stripe_webhook_unknown_invoice", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 200,
      detail: { stripeInvoiceId: invoice.id, type: event.type },
    });
    return apiSuccess({ ignored: "unknown_invoice" }, requestIdValue);
  }

  const current = existing.data.status as Parameters<
    typeof shouldApplyStatus
  >[0];
  const next = invoiceStatusFromStripe(
    invoice.status as StripeInvoiceStatus,
    existing.data.due_date as string,
  );
  const patch: Record<string, unknown> = {
    amount_paid_cents: invoice.amount_paid ?? 0,
  };
  if (invoice.hosted_invoice_url)
    patch.hosted_invoice_url = invoice.hosted_invoice_url;
  if (invoice.invoice_pdf) patch.invoice_pdf_url = invoice.invoice_pdf;
  if (shouldApplyStatus(current, next)) patch.status = next;

  const update = await admin
    .from("invoices")
    .update(patch)
    .eq("id", existing.data.id as string);

  if (update.error) {
    logRequest("error", "stripe_webhook_update_failed", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 500,
      code: "update_failed",
    });
    return apiFailure(
      "update_failed",
      "Invoice update failed.",
      500,
      requestIdValue,
    );
  }

  logRequest("info", "stripe_webhook_applied", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
    detail: { type: event.type, status: patch.status ?? current },
  });
  return apiSuccess({ applied: event.type }, requestIdValue);
}
