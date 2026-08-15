import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { findAuthUserIdByEmail } from "@/lib/supabase/auth-users";

const route = "/api/admin/employees/[id]/temporary-password";

/**
 * Issues a replacement password for an employee without sending email.
 *
 * This is the counterpart to `/invite` for organisations running without SMTP,
 * and the recovery path when someone forgets their password: an administrator
 * issues a new temporary one and hands it over directly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "admin_temporary_password_failed", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status,
      code,
    });
    return apiFailure(code, message, status, requestIdValue);
  };
  const access = await requireAdmin();
  if (!access.ok)
    return fail(
      access.status === 401 ? "unauthorized" : "forbidden",
      access.error,
      access.status,
    );
  // Shares the invite bucket: both are credential-issuing actions against the
  // same employee directory and should be throttled together.
  const limited = await access.client.rpc("consume_api_rate_limit", {
    rate_bucket: "admin:invite",
    maximum_attempts: 10,
    window_seconds: 3600,
  });
  if (limited.error)
    return fail(
      "rate_limit_unavailable",
      "The request could not be safely processed.",
      503,
    );
  if (!limited.data)
    return fail(
      "rate_limited",
      "Too many credential requests. Try again later.",
      429,
    );

  const { id } = await params;
  const admin = createAdminClient();
  const profile = await admin
    .from("users")
    .select("email,full_name,status,deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile.data)
    return fail("employee_not_found", "Employee not found.", 404);
  if (profile.data.status !== "active" || profile.data.deleted_at)
    return fail(
      "employee_inactive",
      "Reactivate the employee before issuing a password.",
      409,
    );

  const email = String(profile.data.email).toLowerCase();
  const temporaryPassword = generateTemporaryPassword();

  // An employee created by invitation may have no Auth account yet, so this
  // both resets an existing account and provisions a missing one.
  const existing = await findAuthUserIdByEmail(admin.auth.admin, email);
  if (!existing.ok)
    return fail("account_lookup_failed", "The account could not be read.", 502);
  const existingId = existing.id;

  const result = existingId
    ? await admin.auth.admin.updateUserById(existingId, {
        password: temporaryPassword,
        email_confirm: true,
      })
    : await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: profile.data.full_name },
      });
  if (result.error)
    return fail(
      "password_failed",
      "The temporary password could not be issued.",
      502,
    );

  await access.client.rpc("audit_admin_action", {
    target_user_id: id,
    admin_action: "temporary_password_issued",
  });
  logRequest("info", "admin_temporary_password_issued", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
  });
  return apiSuccess({ temporaryPassword }, requestIdValue);
}
