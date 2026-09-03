import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InvoiceRow } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripeInvoicing } from "./client";
import { invoiceStatusFromStripe, type StripeInvoiceStatus } from "./invoice-status";

type Db = SupabaseClient<Database>;

function isoDate(epoch: number | null | undefined) {
  return epoch ? new Date(epoch * 1000).toISOString().slice(0, 10) : null;
}

async function findLocalInvoice(db: Db, remote: Stripe.Invoice) {
  const linked = await db
    .from("invoices")
    .select("*")
    .eq("stripe_invoice_id", remote.id)
    .maybeSingle();
  if (linked.error) throw linked.error;
  if (linked.data) return linked.data as InvoiceRow;

  const localId = remote.metadata?.sswsco_invoice_id;
  const localNumber = remote.metadata?.sswsco_invoice_number;
  if (!localId || !localNumber) return null;
  const candidate = await db
    .from("invoices")
    .select("*")
    .eq("id", localId)
    .eq("invoice_number", localNumber)
    .maybeSingle();
  if (candidate.error) throw candidate.error;
  if (
    !candidate.data ||
    candidate.data.stripe_invoice_id ||
    candidate.data.status !== "draft" ||
    remote.currency !== "usd" ||
    Number(remote.amount_due) !== Number(candidate.data.amount_cents)
  ) return null;
  const linkedBack = await db
    .from("invoices")
    .update({ stripe_invoice_id: remote.id })
    .eq("id", localId)
    .is("stripe_invoice_id", null)
    .select("*")
    .single();
  if (linkedBack.error) throw linkedBack.error;
  return linkedBack.data as InvoiceRow;
}

/**
 * Apply a freshly retrieved Stripe snapshot, never an event's stale payload.
 *
 * That distinction is the whole out-of-order defence. Webhooks arrive late,
 * duplicated, and in the wrong order, but every caller here re-retrieves the
 * invoice first, so what gets written is Stripe's current state rather than
 * whatever the event was carrying when it was queued. A replayed
 * `invoice.sent` therefore cannot walk a paid invoice backwards: the retrieve
 * returns `paid` regardless of which event prompted it. There is no status
 * comparison for the same reason — an event that does not change the status
 * still needs its amounts, URLs, and due date synchronized.
 *
 * `eventCreated` is recorded rather than enforced. It is the watermark that
 * says how current this row is, which is what makes a stalled webhook visible
 * during reconciliation.
 */
export async function applyStripeInvoiceSnapshot(
  db: Db,
  remote: Stripe.Invoice,
  eventCreated?: number,
) {
  const local = await findLocalInvoice(db, remote);
  if (!local) return null;
  const canonical = invoiceStatusFromStripe(
    (remote.status ?? "draft") as StripeInvoiceStatus,
  );
  const patch: Database["public"]["Tables"]["invoices"]["Update"] = {
    status: canonical,
    amount_paid_cents: remote.amount_paid ?? 0,
    amount_remaining_cents: remote.amount_remaining ?? remote.amount_due ?? 0,
    hosted_invoice_url: remote.hosted_invoice_url ?? null,
    invoice_pdf_url: remote.invoice_pdf ?? null,
    due_date: isoDate(remote.due_date),
    issued_at: remote.status_transitions?.finalized_at
      ? new Date(remote.status_transitions.finalized_at * 1000).toISOString()
      : local.issued_at,
    stripe_sync_state: "synced",
    stripe_sync_error: null,
    stripe_customer_id_snapshot:
      typeof remote.customer === "string" ? remote.customer : remote.customer?.id ?? null,
    last_stripe_event_created: Math.max(
      local.last_stripe_event_created ?? 0,
      eventCreated ?? 0,
    ),
  };
  if (canonical === "paid") {
    patch.paid_at = remote.status_transitions?.paid_at
      ? new Date(remote.status_transitions.paid_at * 1000).toISOString()
      : new Date().toISOString();
    patch.payment_processing_at = null;
    patch.payment_failed_at = null;
  }
  if (canonical === "void" || canonical === "uncollectible")
    patch.closed_at = new Date().toISOString();
  if (canonical === "open") patch.sent_at = local.sent_at ?? new Date().toISOString();

  const saved = await db
    .from("invoices")
    .update(patch)
    .eq("id", local.id)
    .select("*")
    .single();
  if (saved.error) throw saved.error;
  if (local.revised_from_id && canonical !== "draft") {
    const revision = await db
      .from("invoices")
      .update({ latest_revision_id: local.id })
      .eq("id", local.revised_from_id);
    if (revision.error) throw revision.error;
  }
  return saved.data as InvoiceRow;
}

export async function reconcileStripeInvoiceById(
  stripeInvoiceId: string,
  db: Db = createAdminClient(),
) {
  const stripe = await requireStripeInvoicing();
  const remote = await stripe.invoices.retrieve(stripeInvoiceId);
  return applyStripeInvoiceSnapshot(db, remote);
}

export async function reconcileNonterminalInvoices(limit = 50) {
  const db = createAdminClient();
  const candidates = await db
    .from("invoices")
    .select("stripe_invoice_id")
    .in("status", ["draft", "open", "uncollectible"])
    .not("stripe_invoice_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (candidates.error) throw candidates.error;
  let reconciled = 0;
  const differences: string[] = [];
  for (const candidate of candidates.data) {
    try {
      await reconcileStripeInvoiceById(candidate.stripe_invoice_id as string, db);
      reconciled += 1;
    } catch {
      differences.push(candidate.stripe_invoice_id as string);
    }
  }
  return { checked: candidates.data.length, reconciled, differences };
}
