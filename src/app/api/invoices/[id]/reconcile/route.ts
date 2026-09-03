import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
import { reconcileStripeInvoiceById } from "@/lib/stripe/reconcile";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]/reconcile", "POST"); if (api.denied) return api.denied;
  try {
    const { id } = await params;
    const found = await api.access.db.from("invoices").select("stripe_invoice_id").eq("id", id).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data?.stripe_invoice_id) return api.fail("not_sent", "This draft has no Stripe invoice to reconcile.", 409);
    return api.success(await reconcileStripeInvoiceById(found.data.stripe_invoice_id));
  } catch (error) { const failure = invoiceWriteError(error); return api.fail(failure.code, failure.message, failure.status); }
}
