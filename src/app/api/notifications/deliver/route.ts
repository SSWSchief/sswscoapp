import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { deliverPendingNotifications } from "@/lib/push/deliver";
import { getPushEnv } from "@/lib/push/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const route = "/api/notifications/deliver";

/**
 * Hands whatever notifications are waiting to Web Push.
 *
 * Called by the browser that just did something notifying — created a job,
 * assigned a driver, logged a dry run — because that is the only party that
 * knows the moment has arrived. It takes no arguments and grants no choice
 * over what gets sent: the caller triggers a pass, the server decides what is
 * pending and who it belongs to. So a driver calling this can only ever cause
 * alerts other people were already owed.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "notifications_deliver_failed", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status,
      code,
    });
    return apiFailure(code, message, status, requestIdValue);
  };

  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return fail("unauthorized", "Sign in required.", 401);
  const profile = await db
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.data.user.id)
    .single();
  if (profile.error)
    return fail("profile_missing", "Active employee profile required.", 403);

  try {
    getPushEnv();
  } catch {
    return fail(
      "push_not_configured",
      "Push notifications are not configured on this deployment.",
      503,
    );
  }

  try {
    const result = await deliverPendingNotifications(createAdminClient());
    logRequest("info", "notifications_deliver_ok", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 200,
      detail: result,
    });
    return apiSuccess(result, requestIdValue);
  } catch {
    return fail(
      "delivery_failed",
      "Notifications could not be delivered.",
      502,
    );
  }
}
