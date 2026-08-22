import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";

const route = "/api/push/subscribe";

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "push_subscribe_failed", {
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

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_body", "Request body must be JSON.", 400);
  }
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const authKey = body.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !authKey)
    return fail("invalid_subscription", "Subscription is incomplete.", 400);

  const result = await db.from("push_subscriptions").upsert(
    {
      user_id: profile.data.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: request.headers.get("user-agent") ?? "",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (result.error)
    return fail("subscribe_failed", "Could not save subscription.", 500);

  logRequest("info", "push_subscribe_ok", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
  });
  return apiSuccess({ status: "ok" }, requestIdValue);
}
