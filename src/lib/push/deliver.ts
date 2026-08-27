import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationRow } from "@/lib/supabase/database.types";
import type { AccessRole } from "@/lib/types";
import { getPushEnv } from "./env";
import { notificationLink, notificationTag } from "./notification-link";
import { sendPushToSubscriptions } from "./send";
import { truncate } from "./utils";

/**
 * How recent a notification has to be for a phone alert to still be useful.
 * Anything older is marked delivered and never sent: a notification about a
 * job that was assigned hours ago is not news, and buzzing a driver's phone
 * about it — which is what a delayed retry or a backstop pass would otherwise
 * do — is worse than staying quiet. It is still in the in-app bell either way.
 */
const FRESHNESS_MS = 15 * 60 * 1000;
/** A ceiling on one pass, so a backlog cannot turn into a burst of alerts. */
const BATCH_LIMIT = 100;

type DeliveryResult = {
  claimed: number;
  sent: number;
  pruned: number;
  skipped: number;
};

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Turns the in-app notifications this schema already writes into phone alerts.
 *
 * Everything that matters — a job assigned, a dry run logged, a pre-trip
 * failed — is written to `notifications` by the database function that caused
 * it. Rather than teach each of those to also push, this reads what they wrote.
 * One mechanism, no second copy of the rules about who hears what, and any
 * future notification is pushed the day it is added.
 *
 * Claiming is the whole trick: rows are stamped `pushed_at` by the same
 * statement that selects them, so two dispatchers' browsers firing at once, or
 * a delivery pass overlapping the scheduled one, cannot alert the same person
 * twice for the same event.
 */
export async function deliverPendingNotifications(
  admin: SupabaseClient<Database>,
): Promise<DeliveryResult> {
  const now = Date.now();
  const pending = await admin
    .from("notifications")
    .select("id")
    .is("pushed_at", null)
    .gte("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(BATCH_LIMIT);
  if (pending.error) throw pending.error;
  const pendingIds = (pending.data ?? []).map((row) => row.id as string);
  if (pendingIds.length === 0)
    return { claimed: 0, sent: 0, pruned: 0, skipped: 0 };
  // The claim, and the reason a notification cannot be pushed twice: this
  // statement both stamps and returns, and `.select()` returns only the rows it
  // actually changed. A caller racing it re-evaluates `pushed_at is null`
  // against the committed row and comes away with nothing to send.
  const claimed = await admin
    .from("notifications")
    .update({ pushed_at: new Date(now).toISOString() })
    .in("id", pendingIds)
    .is("pushed_at", null)
    .select("*");
  if (claimed.error) throw claimed.error;
  const rows = (claimed.data ?? []) as NotificationRow[];
  // Older rows are claimed above only to keep them from being re-scanned
  // forever; they are deliberately not sent.
  const fresh = rows.filter(
    (row) => Date.parse(row.created_at) > now - FRESHNESS_MS,
  );
  const result: DeliveryResult = {
    claimed: rows.length,
    sent: 0,
    pruned: 0,
    skipped: rows.length - fresh.length,
  };
  if (fresh.length === 0) return result;

  // Checked once here rather than per send: without keys every send below
  // fails identically, and a deployment missing them should read as a
  // configuration fault in the logs, not as silence.
  getPushEnv();

  const recipientIds = [...new Set(fresh.map((row) => row.recipient_user_id))];
  const [recipients, subscriptions] = await Promise.all([
    admin.from("users").select("id, access_role").in("id", recipientIds),
    admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds),
  ]);
  const roleById = new Map(
    (recipients.data ?? []).map((row) => [
      row.id as string,
      row.access_role as AccessRole,
    ]),
  );
  const subscriptionsByUser = new Map<string, SubscriptionRow[]>();
  for (const row of (subscriptions.data ?? []) as SubscriptionRow[]) {
    const list = subscriptionsByUser.get(row.user_id) ?? [];
    list.push(row);
    subscriptionsByUser.set(row.user_id, list);
  }

  const staleIds: string[] = [];
  for (const row of fresh) {
    const targets = subscriptionsByUser.get(row.recipient_user_id) ?? [];
    if (targets.length === 0) continue;
    const role = roleById.get(row.recipient_user_id);
    const sent = await sendPushToSubscriptions(
      targets.map((target) => ({
        id: target.id,
        endpoint: target.endpoint,
        p256dh: target.p256dh,
        auth: target.auth,
      })),
      {
        title: truncate(row.title, 80),
        body: truncate(row.body, 160),
        icon: "/icons/icon-192.png",
        tag: notificationTag(row.id, row.related_job_id),
        data: { url: notificationLink(role, row.related_job_id) },
      },
    );
    result.sent += sent.sent;
    staleIds.push(...sent.staleIds);
  }

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
    result.pruned = staleIds.length;
  }
  return result;
}
