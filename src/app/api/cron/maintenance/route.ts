import {
  apiFailure,
  apiSuccess,
  logRequest,
  requestId,
} from "@/lib/api-response";
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
  const result = await createAdminClient().rpc(
    "run_scheduled_maintenance_safe",
    {},
  );
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
  logRequest("info", "scheduled_maintenance_complete", {
    requestId: requestIdValue,
    route,
    method: "GET",
    startedAt,
    status: 200,
  });
  return apiSuccess({ status: "ok", result: result.data }, requestIdValue);
}
