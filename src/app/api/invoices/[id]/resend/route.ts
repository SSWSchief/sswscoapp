import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
import { resendInvoice } from "@/lib/stripe/invoice-lifecycle";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]/resend", "POST"); if (api.denied) return api.denied;
  try { const { id } = await params; return api.success(await resendInvoice(id)); }
  catch (error) { const failure = invoiceWriteError(error); return api.fail(failure.code, failure.message, failure.status); }
}
