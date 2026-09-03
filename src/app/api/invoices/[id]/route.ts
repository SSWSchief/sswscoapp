import type { Json } from "@/lib/supabase/database.types";
import { authorizedInvoiceApi, invoiceWriteError } from "@/lib/invoices/api";
import { invoiceDraftSchema, invoiceValidationMessage } from "@/lib/invoices/validation";
import { jsonBodySizeAllowed } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/[id]", "PATCH");
  if (api.denied) return api.denied;
  if (!jsonBodySizeAllowed(request, 64_000)) return api.fail("payload_too_large", "Request body is too large.", 413);
  let raw: unknown;
  try { raw = await request.json(); } catch { return api.fail("invalid_json", "Invalid JSON body.", 400); }
  const parsed = invoiceDraftSchema.safeParse(raw);
  if (!parsed.success) return api.fail("invalid_invoice", invoiceValidationMessage(parsed.error), 400);
  const { id } = await params;
  const payload = { ...parsed.data, items: parsed.data.items.map((item, position) => ({ ...item, position })) };
  const result = await api.access.db.rpc("update_invoice_draft", { target_invoice_id: id, payload: payload as unknown as Json });
  if (result.error) { const failure = invoiceWriteError(result.error); return api.fail(failure.code, failure.message, failure.status); }
  return api.success(result.data);
}
