import { apiFailure, apiSuccess, logRequest, requestId } from "@/lib/api-response";
import { getPushEnv } from "@/lib/push/env";
import { sendPushToSubscriptions } from "@/lib/push/send";
import { truncate } from "@/lib/push/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const route = "/api/messages/notify";

/**
 * Mirrors has_permission('messages')'s defaults: every access role includes
 * 'messages' by default, so the only thing that can turn it off is an
 * explicit override. (The admin role's admin_mfa_verified() gate is a live
 * session property, not something a background push can evaluate — treated
 * as permitted here rather than excluding admins from broadcast pushes.)
 */
function hasMessagesPermission(overrides: unknown): boolean {
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    const value = (overrides as Record<string, unknown>).messages;
    if (typeof value === "boolean") return value;
  }
  return true;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "messages_notify_failed", {
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
  const sender = await db
    .from("users")
    .select("id, full_name")
    .eq("auth_user_id", auth.data.user.id)
    .single();
  if (sender.error)
    return fail("profile_missing", "Active employee profile required.", 403);

  let body: { channelId?: string };
  try {
    body = await request.json();
  } catch {
    return fail("invalid_body", "Request body must be JSON.", 400);
  }
  const channelId = body.channelId;
  if (!channelId) return fail("invalid_body", "channelId is required.", 400);

  // Re-read the caller's own latest message in this channel through their
  // own session, rather than trusting anything client-supplied: RLS already
  // proved they were allowed to insert into this channel, so this is safe.
  const message = await db
    .from("messages")
    .select("body")
    .eq("channel_id", channelId)
    .eq("sender_id", sender.data.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (message.error)
    return fail("message_not_found", "No matching message found.", 404);

  const channel = await db
    .from("message_channels")
    .select("kind")
    .eq("id", channelId)
    .single();
  if (channel.error)
    return fail("channel_not_found", "Channel not found.", 404);

  const admin = createAdminClient();
  let recipientIds: string[];
  if (channel.data.kind === "direct") {
    const members = await admin
      .from("message_channel_members")
      .select("user_id")
      .eq("channel_id", channelId)
      .neq("user_id", sender.data.id);
    recipientIds = (members.data ?? []).map((row) => row.user_id as string);
  } else {
    const users = await admin
      .from("users")
      .select("id, permission_overrides")
      .eq("status", "active")
      .is("deleted_at", null)
      .neq("id", sender.data.id);
    recipientIds = (users.data ?? [])
      .filter((row) => hasMessagesPermission(row.permission_overrides))
      .map((row) => row.id as string);
  }

  if (recipientIds.length === 0) {
    logRequest("info", "messages_notify_ok", {
      requestId: requestIdValue,
      route,
      method: "POST",
      startedAt,
      status: 200,
    });
    return apiSuccess({ sent: 0, pruned: 0 }, requestIdValue);
  }

  const recipients = await admin
    .from("users")
    .select("id, access_role")
    .in("id", recipientIds);
  const roleById = new Map(
    (recipients.data ?? []).map((row) => [row.id as string, row.access_role as string]),
  );

  const subscriptions = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", recipientIds);

  interface SubscriptionRow {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const row of (subscriptions.data ?? []) as SubscriptionRow[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  // Without VAPID keys every send below throws the same error for every
  // recipient. Fail once, with a code that names the cause, so a deployment
  // missing its keys is visible in the logs instead of looking like silence.
  try {
    getPushEnv();
  } catch {
    return fail(
      "push_not_configured",
      "Push notifications are not configured on this deployment.",
      503,
    );
  }

  const messageBody = truncate(message.data.body, 120);
  let sent = 0;
  const staleIds: string[] = [];
  for (const [userId, rows] of byUser) {
    if (rows.length === 0) continue;
    const role = roleById.get(userId);
    const url =
      role === "driver"
        ? `/driver/messages?channel=${channelId}`
        : `/dispatcher/messages?channel=${channelId}`;
    const result = await sendPushToSubscriptions(
      rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      })),
      {
        title: sender.data.full_name,
        body: messageBody,
        icon: "/icons/icon-192.png",
        tag: `message-${channelId}`,
        data: { url },
      },
    );
    sent += result.sent;
    staleIds.push(...result.staleIds);
  }

  if (staleIds.length > 0)
    await admin.from("push_subscriptions").delete().in("id", staleIds);

  logRequest("info", "messages_notify_ok", {
    requestId: requestIdValue,
    route,
    method: "POST",
    startedAt,
    status: 200,
  });
  return apiSuccess({ sent, pruned: staleIds.length }, requestIdValue);
}
