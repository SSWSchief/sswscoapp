import "server-only";
import { getWebPush } from "./client";

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionTarget[],
  payload: PushPayload,
): Promise<{ sent: number; staleIds: string[] }> {
  const webpush = getWebPush();
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      ),
    ),
  );

  let sent = 0;
  const staleIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }
    const statusCode = (result.reason as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410)
      staleIds.push(subscriptions[index].id);
  });
  return { sent, staleIds };
}
