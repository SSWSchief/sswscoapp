import "server-only";
import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { invoiceSession } from "./authorization";

function invoiceApi(request: Request, route: string, method: string) {
  const startedAt = Date.now();
  const id = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "invoice_request_failed", {
      requestId: id, route, method, startedAt, status, code,
    });
    return apiFailure(code, message, status, id);
  };
  return { id, fail, success: <T,>(data: T, status = 200) => apiSuccess(data, id, status) };
}

export async function authorizedInvoiceApi(request: Request, route: string, method: string) {
  const response = invoiceApi(request, route, method);
  const access = await invoiceSession();
  if (!access.ok)
    return {
      ...response,
      denied: response.fail(access.reason, access.reason === "unauthorized" ? "Unauthorized." : "Invoices permission is required.", access.reason === "unauthorized" ? 401 : 403),
    };
  const limited = await access.db.rpc("consume_api_rate_limit", {
    rate_bucket: "invoice:write",
    maximum_attempts: 600,
    window_seconds: 3600,
  });
  if (limited.error)
    return { ...response, denied: response.fail("rate_limit_unavailable", "The request could not be safely processed.", 503) };
  if (!limited.data)
    return { ...response, denied: response.fail("rate_limited", "Too many invoice requests. Try again later.", 429) };
  return { ...response, access, denied: null };
}

export function invoiceWriteError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "Invoice operation failed.");
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique") || lower.includes("already"))
    return { code: "invoice_conflict", message: "A selected job is already attached to another active invoice.", status: 409 };
  if (lower.includes("not found")) return { code: "not_found", message: "Invoice not found.", status: 404 };
  const safeBusinessMessage = [
    "only a draft", "only unsent drafts", "only an open", "at least one",
    "billing contact", "billing address", "invoice line total", "invoice number exceeds",
    "tax policy is approved", "stripe invoicing is disabled", "cannot make that stripe transition", "company invoice terms",
    "every invoiced job",
    "original stripe invoice", "existing draft cannot change customers",
  ].some((fragment) => lower.includes(fragment));
  if (safeBusinessMessage)
    return { code: "invalid_invoice_state", message, status: 409 };
  return { code: "invoice_operation_failed", message: "The invoice operation could not be completed. Try again.", status: 502 };
}
