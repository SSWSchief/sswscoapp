import type Stripe from "stripe";
import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { webhookSigningSecret } from "@/lib/stripe/env";
import { applyStripeInvoiceSnapshot } from "@/lib/stripe/reconcile";

const route = "/api/webhooks/stripe";
const INVOICE_EVENTS = new Set([
  "invoice.created",
  "invoice.updated",
  "invoice.finalized",
  "invoice.sent",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.marked_uncollectible",
  "invoice.voided",
]);
const PAYMENT_EVENTS = new Set(["payment_intent.processing", "payment_intent.payment_failed"]);

async function processEvent(event: Stripe.Event) {
  const db = createAdminClient();
  const stripe = createStripeClient();
  if (INVOICE_EVENTS.has(event.type)) {
    const eventInvoice = event.data.object as Stripe.Invoice;
    const remote = await stripe.invoices.retrieve(eventInvoice.id);
    const local = await applyStripeInvoiceSnapshot(db, remote, event.created);
    if (!local) return "ignored" as const;
    const patch: Record<string, string | null> = {};
    if (event.type === "invoice.payment_failed") {
      patch.payment_failed_at = new Date(event.created * 1000).toISOString();
      patch.payment_processing_at = null;
    }
    if (event.type === "invoice.payment_action_required") {
      patch.payment_processing_at = new Date(event.created * 1000).toISOString();
      patch.payment_failed_at = null;
    }
    if (Object.keys(patch).length && local.status === "open") {
      const updated = await db.from("invoices").update(patch).eq("id", local.id);
      if (updated.error) throw updated.error;
    }
    return "processed" as const;
  }
  if (PAYMENT_EVENTS.has(event.type)) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const payments = await stripe.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: intent.id },
      limit: 1,
    });
    const invoicePayment = payments.data[0];
    const invoiceId = typeof invoicePayment?.invoice === "string"
      ? invoicePayment.invoice
      : invoicePayment?.invoice?.id;
    if (!invoiceId) return "ignored" as const;
    const remote = await stripe.invoices.retrieve(invoiceId);
    const local = await applyStripeInvoiceSnapshot(db, remote, event.created);
    if (!local) return "ignored" as const;
    if (local.status !== "open") return "processed" as const;
    const timestamp = new Date(event.created * 1000).toISOString();
    const updated = await db.from("invoices").update(
      event.type === "payment_intent.processing"
        ? { payment_processing_at: timestamp, payment_failed_at: null }
        : { payment_failed_at: timestamp, payment_processing_at: null },
    ).eq("id", local.id);
    if (updated.error) throw updated.error;
    return "processed" as const;
  }
  return "ignored" as const;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "stripe_webhook_failed", {
      requestId: id, route, method: "POST", startedAt, status, code,
    });
    return apiFailure(code, message, status, id);
  };
  const secret = webhookSigningSecret();
  if (!secret) return fail("webhook_not_configured", "Stripe webhook secret is not configured for this deployment.", 500);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail("missing_signature", "Missing Stripe signature.", 400);
  const payload = await request.text();
  let event: Stripe.Event;
  try { event = createStripeClient().webhooks.constructEvent(payload, signature, secret); }
  catch { return fail("invalid_signature", "Signature verification failed.", 400); }

  const expected = process.env.STRIPE_EXPECTED_MODE;
  if (expected && event.livemode !== (expected === "live"))
    return fail("stripe_mode_mismatch", "Webhook mode does not match this deployment.", 400);

  const object = event.data.object as { id?: string };
  const db = createAdminClient();
  const claim = await db.rpc("claim_stripe_webhook_event", {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    stripe_object_id: object.id ?? "unknown",
    stripe_livemode: event.livemode,
    stripe_event_created: event.created,
  });
  if (claim.error)
    return fail("webhook_record_failed", "Webhook event could not be recorded.", 500);
  if (claim.data !== "claimed") return apiSuccess({ duplicate: event.id, status: claim.data }, id);

  try {
    const status = await processEvent(event);
    const saved = await db.from("stripe_webhook_events").update({
      status,
      last_error: null,
      processing_started_at: null,
      processed_at: new Date().toISOString(),
    }).eq("event_id", event.id);
    if (saved.error) throw saved.error;
    return apiSuccess({ status, type: event.type }, id);
  } catch (error) {
    await db.from("stripe_webhook_events").update({
      status: "pending",
      last_error: (error instanceof Error ? error.message : "Processing failed.").slice(0, 500),
      processing_started_at: null,
    }).eq("event_id", event.id);
    return fail("webhook_processing_failed", "Webhook processing failed and will be retried.", 500);
  }
}
