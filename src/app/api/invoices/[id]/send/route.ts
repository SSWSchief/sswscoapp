import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
import { sendInvoice } from "@/lib/stripe/invoice-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]/send", "POST");
  if (api.denied) return api.denied;
  const limited = await api.access.db.rpc("consume_api_rate_limit", { rate_bucket: "invoice:send", maximum_attempts: 60, window_seconds: 3600 });
  if (limited.error) return api.fail("rate_limit_unavailable", "The request could not be safely processed.", 503);
  if (!limited.data) return api.fail("rate_limited", "Too many invoices sent. Try again later.", 429);
  try {
    const { id } = await params;
    const invoice = await sendInvoice(id);
    return api.success({ invoice, hostedInvoiceUrl: invoice?.hosted_invoice_url ?? null });
  } catch (error) {
    const failure = invoiceWriteError(error);
    return api.fail(failure.code, failure.message, failure.status);
  }
}
