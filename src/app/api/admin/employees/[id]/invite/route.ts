import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailDeliveryEnabled } from "@/lib/email-delivery";
import { emailRedirectUrl } from "@/lib/app-url";

const route = "/api/admin/employees/[id]/invite";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "admin_invite_failed", {
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
  // Supabase accepts `resetPasswordForEmail` without custom SMTP and resolves
  // it successfully regardless — it just delivers nothing. Refused here rather
  // than reporting "initiated" for a message that never leaves the project, the
  // same reasoning already applied to invitation delivery at employee creation.
  if (!emailDeliveryEnabled())
    return fail(
      "email_delivery_disabled",
      "Email sending is not configured, so a reset email cannot be delivered. Issue a temporary password instead.",
      409,
    );
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
      "Too many invitation requests. Try again later.",
      429,
    );
  const { id } = await params;
  const admin = createAdminClient();
  const profile = await admin
    .from("users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!profile.data)
    return fail("employee_not_found", "Employee not found.", 404);
  // Deliberately not `new URL(request.url).origin`. That is whichever host the
  // administrator happened to be signed in on, and the team-scoped Vercel alias
  // is SSO-protected — a reset issued from there emailed the employee a link to
  // a Vercel login page. The public address is resolved from configuration.
  let redirectTo: string;
  try {
    redirectTo = emailRedirectUrl("/reset-password");
  } catch {
    return fail(
      "app_url_unconfigured",
      "The application has no public address configured, so a reset link would be undeliverable. Nothing was sent.",
      500,
    );
  }
  const result = await admin.auth.resetPasswordForEmail(profile.data.email, {
    redirectTo,
  });
  if (result.error)
    return fail(
      "invite_failed",
      "The password setup email could not be sent.",
      502,
    );
  await access.client.rpc("audit_admin_action", {
    target_user_id: id,
    admin_action: "password_reset_initiated",
  });
  logRequest("info", "admin_invite_sent", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
  });
  return apiSuccess({ ok: true }, requestIdValue);
}
