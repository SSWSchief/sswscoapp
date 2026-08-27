"use client";

import { log } from "@/lib/logger";

/**
 * Ask the server to push whatever notifications the last mutation created.
 *
 * Deliberately fire-and-forget: the operation the user performed has already
 * succeeded by the time this runs, and a failed push is not a reason to tell
 * them their job was not created. Failures are logged, and the notification is
 * still in the recipient's in-app bell regardless.
 */
export function requestNotificationDelivery(): void {
  void fetch("/api/notifications/deliver", { method: "POST" }).catch((error) =>
    log("warn", "push_delivery_request_failed", { error: String(error) }),
  );
}
