import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, InvoiceLineItemRow, InvoiceRow } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripeInvoicing, stripeKeyMode } from "./client";
import {
  createStripeInvoiceDraft,
  findStripeInvoiceByLocalMetadata,
  finalizeAndSendStripeInvoice,
  replaceStripeInvoiceItems,
  resendStripeInvoice,
  syncStripeCustomer,
} from "./invoice-push";
import { applyStripeInvoiceSnapshot } from "./reconcile";

type Db = SupabaseClient<Database>;

async function loadInvoice(db: Db, id: string) {
  const [invoice, lines, links, settings] = await Promise.all([
    db.from("invoices").select("*").eq("id", id).maybeSingle(),
    db.from("invoice_line_items").select("*").eq("invoice_id", id).order("position"),
    db.from("invoice_jobs").select("job_id").eq("invoice_id", id),
    db.from("company_settings").select("invoice_terms,tax_policy_status").maybeSingle(),
  ]);
  const error = invoice.error ?? lines.error ?? links.error ?? settings.error;
  if (error) throw error;
  if (!invoice.data) throw new Error("Invoice not found.");
  const jobIds = (links.data ?? []).map((link) => link.job_id);
  const jobs = jobIds.length
    ? await db.from("jobs").select("id,customer_id,status,deleted_at").in("id", jobIds)
    : { data: [], error: null };
  if (jobs.error) throw jobs.error;
  return {
    invoice: invoice.data as InvoiceRow,
    lines: (lines.data ?? []) as InvoiceLineItemRow[],
    terms: String(settings.data?.invoice_terms ?? ""),
    taxPolicy: String(settings.data?.tax_policy_status ?? "pending"),
    jobs: jobs.data ?? [],
  };
}

function validateForSend(invoice: InvoiceRow, lines: InvoiceLineItemRow[], jobs: Array<{ customer_id: string; status: string; deleted_at: string | null }>, terms: string, taxPolicy: string) {
  if (invoice.status !== "draft") throw new Error("Only a draft can be sent.");
  if (!lines.length || invoice.amount_cents <= 0) throw new Error("Add at least one positive line item.");
  const lineTotal = lines.reduce((sum, line) => sum + Number(line.amount_cents), 0);
  if (lineTotal !== Number(invoice.amount_cents)) throw new Error("Invoice line total is out of sync.");
  if (!jobs.length || jobs.some((job) => job.customer_id !== invoice.customer_id || job.status !== "complete" || job.deleted_at))
    throw new Error("Every invoiced job must still be complete and belong to the customer.");
  if (!invoice.billing_contact_name.trim() || !/^\S+@\S+\.\S+$/.test(invoice.billing_email))
    throw new Error("Review the billing contact name and email before sending.");
  if (![invoice.billing_address_line1, invoice.billing_city, invoice.billing_state, invoice.billing_postal_code].every((value) => value.trim()))
    throw new Error("Review the complete US billing address before sending.");
  if (invoice.invoice_number.length > 26) throw new Error("Invoice number exceeds Stripe's 26-character limit.");
  if (!terms.trim()) throw new Error("Company invoice terms are required before sending.");
  if (stripeKeyMode() === "live" && taxPolicy !== "non_taxable_approved")
    throw new Error("Live sending is blocked until the invoice tax policy is approved.");
}

export async function sendInvoice(id: string, db: Db = createAdminClient()) {
  const loaded = await loadInvoice(db, id);
  if (loaded.invoice.stripe_invoice_id && loaded.invoice.status !== "draft") {
    const stripe = await requireStripeInvoicing();
    return applyStripeInvoiceSnapshot(db, await stripe.invoices.retrieve(loaded.invoice.stripe_invoice_id));
  }
  validateForSend(loaded.invoice, loaded.lines, loaded.jobs, loaded.terms, loaded.taxPolicy);
  const stripe = await requireStripeInvoicing();
  const processing = await db.from("invoices").update({ stripe_sync_state: "processing", stripe_sync_error: null }).eq("id", id);
  if (processing.error) throw processing.error;
  try {
    const customer = await db.from("customers").select("*").eq("id", loaded.invoice.customer_id).single();
    if (customer.error) throw customer.error;
    const stripeCustomerId = await syncStripeCustomer(stripe, {
      id: customer.data.id,
      name: loaded.invoice.billing_contact_name,
      email: loaded.invoice.billing_email,
      phone: customer.data.phone,
      address: {
        line1: loaded.invoice.billing_address_line1,
        line2: loaded.invoice.billing_address_line2,
        city: loaded.invoice.billing_city,
        state: loaded.invoice.billing_state,
        postalCode: loaded.invoice.billing_postal_code,
        country: "US",
      },
      stripeCustomerId: customer.data.stripe_customer_id,
    });
    if (customer.data.stripe_customer_id !== stripeCustomerId) {
      const savedCustomer = await db.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.data.id);
      if (savedCustomer.error) throw savedCustomer.error;
    }
    let stripeInvoiceId = loaded.invoice.stripe_invoice_id;
    if (!stripeInvoiceId) {
      let revisedStripeInvoiceId: string | null = null;
      if (loaded.invoice.revised_from_id) {
        const original = await db.from("invoices").select("stripe_invoice_id").eq("id", loaded.invoice.revised_from_id).single();
        if (original.error || !original.data.stripe_invoice_id) throw new Error("The original Stripe invoice could not be found.");
        revisedStripeInvoiceId = original.data.stripe_invoice_id;
      }
      const pushableDraft = {
        id,
        invoiceNumber: loaded.invoice.invoice_number,
        paymentTerms: loaded.invoice.payment_terms,
        notes: loaded.invoice.notes,
        poNumber: loaded.invoice.po_number,
        terms: loaded.terms,
        lineItems: loaded.lines.map((line) => ({
          id: line.id,
          description: line.description,
          amountCents: Number(line.amount_cents),
          jobId: line.job_id,
          category: line.category,
        })),
      };
      const remoteDraft =
        (await findStripeInvoiceByLocalMetadata(stripe, pushableDraft)) ??
        (await createStripeInvoiceDraft(stripe, pushableDraft, stripeCustomerId, revisedStripeInvoiceId));
      stripeInvoiceId = remoteDraft.id;
      const linked = await db.from("invoices").update({ stripe_invoice_id: stripeInvoiceId, stripe_customer_id_snapshot: stripeCustomerId }).eq("id", id);
      if (linked.error) throw linked.error;
    }
    const pushable = {
      id,
      invoiceNumber: loaded.invoice.invoice_number,
      paymentTerms: loaded.invoice.payment_terms,
      notes: loaded.invoice.notes,
      poNumber: loaded.invoice.po_number,
      terms: loaded.terms,
      lineItems: loaded.lines.map((line) => ({ id: line.id, description: line.description, amountCents: Number(line.amount_cents), jobId: line.job_id, category: line.category })),
    };
    const currentRemote = await stripe.invoices.retrieve(stripeInvoiceId);
    const sent = currentRemote.status === "draft"
      ? (await replaceStripeInvoiceItems(stripe, pushable, stripeCustomerId, stripeInvoiceId), await finalizeAndSendStripeInvoice(stripe, id, stripeInvoiceId))
      : currentRemote.status === "open"
        ? { invoice: await stripe.invoices.sendInvoice(stripeInvoiceId, undefined, { idempotencyKey: `invoice:${id}:send` }) }
        : { invoice: currentRemote };
    if (loaded.invoice.revised_from_id) {
      const original = await db.from("invoices").select("stripe_invoice_id").eq("id", loaded.invoice.revised_from_id).single();
      if (original.error || !original.data.stripe_invoice_id) throw new Error("The original Stripe invoice could not be reconciled.");
      const remoteOriginal = await stripe.invoices.retrieve(original.data.stripe_invoice_id);
      await applyStripeInvoiceSnapshot(db, remoteOriginal);
      const activated = await db.from("invoice_jobs").update({ active: true }).eq("invoice_id", id);
      if (activated.error) throw activated.error;
    }
    return applyStripeInvoiceSnapshot(db, sent.invoice);
  } catch (error) {
    await db.from("invoices").update({ stripe_sync_state: "failed", stripe_sync_error: "Stripe synchronization failed. Retry or reconcile this invoice." }).eq("id", id);
    throw error;
  }
}

export async function resendInvoice(id: string, db: Db = createAdminClient()) {
  const loaded = await loadInvoice(db, id);
  if (!loaded.invoice.stripe_invoice_id || loaded.invoice.status !== "open")
    throw new Error("Only an open Stripe invoice can be resent.");
  const stripe = await requireStripeInvoicing();
  const remote = await resendStripeInvoice(stripe, id, loaded.invoice.stripe_invoice_id);
  return applyStripeInvoiceSnapshot(db, remote);
}

export async function transitionInvoice(id: string, transition: "void" | "uncollectible", db: Db = createAdminClient()) {
  const loaded = await loadInvoice(db, id);
  const eligible = transition === "void"
    ? ["open", "uncollectible"].includes(loaded.invoice.status)
    : loaded.invoice.status === "open";
  if (!loaded.invoice.stripe_invoice_id || !eligible)
    throw new Error("This invoice cannot make that Stripe transition.");
  const stripe = await requireStripeInvoicing();
  const remote = transition === "void"
    ? await stripe.invoices.voidInvoice(loaded.invoice.stripe_invoice_id, undefined, { idempotencyKey: `invoice:${id}:void` })
    : await stripe.invoices.markUncollectible(loaded.invoice.stripe_invoice_id, undefined, { idempotencyKey: `invoice:${id}:uncollectible` });
  return applyStripeInvoiceSnapshot(db, remote);
}
