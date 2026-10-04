import { NextResponse } from "next/server";
import { logRequest, requestId } from "@/lib/api-response";
import { resolveAppUrl } from "@/lib/app-url";
import { ConfirmationError, respondToConfirmation } from "@/lib/job-confirmations/service";
import { createAdminClient } from "@/lib/supabase/admin";

const route = "/api/confirmations/[token]";

/**
 * The customer's answer, posted from their confirmation page. Public: the
 * unguessable token in the address is the customer's authority, and it only
 * ever answers for its own job. Opening the emailed link never answers on its
 * own, because mail filters open links to scan them; only this POST does.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const startedAt = Date.now();
  const id = requestId(request);
  const { token } = await params;
  const back = (query: string) =>
    NextResponse.redirect(`${resolveAppUrl().url}/confirm/${encodeURIComponent(token)}?${query}`, 303);
  const form = await request.formData().catch(() => null);
  const action = form?.get("action");
  const note = String(form?.get("note") ?? "");
  if (action !== "confirmed" && action !== "change_requested") return back("error=invalid");
  try {
    await respondToConfirmation(createAdminClient(), token, { action, note });
    logRequest("info", "job_confirmation_answered", { requestId: id, route, method: "POST", startedAt, status: 303 });
    return back(`answered=${action}`);
  } catch (error) {
    const problem = error instanceof ConfirmationError ? error.problem : "failed";
    logRequest(problem === "failed" ? "error" : "warn", "job_confirmation_answer_failed", { requestId: id, route, method: "POST", startedAt, status: 303, code: problem });
    return back(`error=${problem}`);
  }
}
