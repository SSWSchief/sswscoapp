import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { customerEmailConfigured } from "@/lib/email/resend";
import { ConfirmationError, sendJobConfirmation } from "@/lib/job-confirmations/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const route = "/api/jobs/[id]/confirmation";
const problemStatus = { not_configured: 503, not_found: 404, job_closed: 409, no_email: 422, superseded: 409 } as const;

/** Staff with jobs access only; returns their profile id. */
async function staff(request: Request, method: string) {
  const startedAt = Date.now();
  const id = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "job_confirmation_failed", { requestId: id, route, method, startedAt, status, code });
    return apiFailure(code, message, status, id);
  };
  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return { denied: fail("unauthorized", "Sign in required.", 401), id, fail };
  const permission = await db.rpc("has_permission", { permission_key: "jobs" });
  if (permission.data !== true) return { denied: fail("forbidden", "Jobs permission required.", 403), id, fail };
  const profile = await db.from("users").select("id").eq("auth_user_id", auth.data.user.id).single();
  if (profile.error) return { denied: fail("profile_missing", "Active employee profile required.", 403), id, fail };
  return { denied: null, id, fail, userId: profile.data.id };
}

/** Whether confirmation emails are on, and the job's current confirmation. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await staff(request, "GET");
  if (access.denied) return access.denied;
  const { id: jobId } = await params;
  const current = await createAdminClient()
    .from("job_confirmations")
    .select("id,recipient_email,scheduled_for,sent_at,send_error,response,response_note,responded_at,created_at")
    .eq("job_id", jobId)
    .is("superseded_at", null)
    .maybeSingle();
  if (current.error) return access.fail("confirmation_lookup_failed", "The confirmation could not be loaded.", 500);
  return apiSuccess({ enabled: customerEmailConfigured(), current: current.data }, access.id);
}

/** Send (or resend) the job's confirmation email. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await staff(request, "POST");
  if (access.denied) return access.denied;
  const { id: jobId } = await params;
  let email: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.slice(0, 320) : undefined;
  } catch {
    email = undefined;
  }
  try {
    const result = await sendJobConfirmation(createAdminClient(), { jobId, email, requestedById: access.userId });
    if (result.error) return access.fail("send_failed", result.error, 502);
    return apiSuccess(result, access.id);
  } catch (error) {
    if (error instanceof ConfirmationError)
      return access.fail(error.problem, error.message, problemStatus[error.problem]);
    return access.fail("send_failed", "The confirmation could not be sent.", 500);
  }
}
