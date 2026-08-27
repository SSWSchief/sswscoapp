import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
import { deliverPendingNotifications } from "@/lib/push/deliver";
import { log } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const route = "/api/cron/maintenance";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const expected = process.env.CRON_SECRET;
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  ) {
    logRequest("warn", "scheduled_maintenance_rejected", {
      requestId: requestIdValue,
      route,
      method: "GET",
      startedAt,
      status: 401,
      code: "unauthorized",
    });
    return apiFailure("unauthorized", "Unauthorized.", 401, requestIdValue);
  }
  const admin = createAdminClient();
  const result = await admin.rpc("run_scheduled_maintenance_safe", {});
  if (result.error) {
    logRequest("error", "scheduled_maintenance_failed", {
      requestId: requestIdValue,
      route,
      method: "GET",
      startedAt,
      status: 500,
      code: "maintenance_failed",
    });
    return apiFailure(
      "maintenance_failed",
      "Scheduled maintenance failed.",
      500,
      requestIdValue,
    );
  }
  // Maintenance writes notifications of its own — the unassigned-job alerts —
  // and nobody's browser is open to ask for those to be delivered. The pass
  // only sends what is still fresh, so this cannot resurrect a stale backlog.
  let delivery = null;
  try {
    delivery = await deliverPendingNotifications(admin);
  } catch (error) {
    log("warn", "scheduled_push_delivery_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
  logRequest("info", "scheduled_maintenance_complete", {
    requestId: requestIdValue,
    route,
    method: "GET",
    startedAt,
    status: 200,
  });
  return apiSuccess(
    { status: "ok", result: result.data, delivery },
    requestIdValue,
  );
}
