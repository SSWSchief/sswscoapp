import type { Json } from "@/lib/supabase/database.types";
import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]/revise", "POST"); if (api.denied) return api.denied;
  try {
    const { id } = await params;
    const [invoice, lines, jobs] = await Promise.all([
      api.access.db.from("invoices").select("*").eq("id", id).maybeSingle(),
      api.access.db.from("invoice_line_items").select("*").eq("invoice_id", id).order("position"),
      api.access.db.from("invoice_jobs").select("job_id").eq("invoice_id", id),
    ]);
    const error = invoice.error ?? lines.error ?? jobs.error; if (error) throw error;
    if (!invoice.data || !["open", "uncollectible"].includes(invoice.data.status)) return api.fail("invalid_invoice_state", "Only an open or uncollectible invoice can be revised.", 409);
    if (invoice.data.latest_revision_id) return api.fail("invoice_conflict", "This invoice already has a revision.", 409);
    const payload = { customerId: invoice.data.customer_id, billingMode: invoice.data.billing_mode, jobIds: (jobs.data ?? []).map((job) => job.job_id), paymentTerms: invoice.data.payment_terms, poNumber: invoice.data.po_number, notes: invoice.data.notes, revisedFromId: id, items: (lines.data ?? []).map((line, position) => ({ description: line.description, amountCents: line.amount_cents, jobId: line.job_id, category: line.category, position })) };
    const created = await api.access.db.rpc("create_invoice_draft", { payload: payload as unknown as Json });
    if (created.error) throw created.error;
    return api.success(created.data, 201);
  } catch (error) { const failure = invoiceWriteError(error); return api.fail(failure.code, failure.message, failure.status); }
}
