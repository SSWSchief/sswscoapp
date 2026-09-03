import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
import { transitionInvoice } from "@/lib/stripe/invoice-lifecycle";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]/void", "POST"); if (api.denied) return api.denied;
  try { const { id } = await params; return api.success(await transitionInvoice(id, "void")); }
  catch (error) { const failure = invoiceWriteError(error); return api.fail(failure.code, failure.message, failure.status); }
}
