import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";

const route = "/api/push/unsubscribe";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "push_unsubscribe_failed", {
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

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return fail("invalid_body", "Request body must be JSON.", 400);
  }
  if (!body.endpoint)
    return fail("invalid_body", "endpoint is required.", 400);

  const result = await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint);
  if (result.error)
    return fail("unsubscribe_failed", "Could not remove subscription.", 500);

  logRequest("info", "push_unsubscribe_ok", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
  });
  return apiSuccess({ status: "ok" }, requestIdValue);
}
