import type { AccessRole } from "@/lib/types";

/**
 * Where tapping a pushed notification should land.
 *
 * Drivers and staff see the same event through different portals, so the
 * destination depends on who is being woken up, not on what happened: a driver
 * tapping "New job assigned" wants their own job screen, and a dispatcher
 * tapping "Dry run logged" wants the dispatch view of that same job.
 *
 * Anything without a job falls back to the portal's landing screen, where the
 * notification bell is — which is at worst one tap from the detail, and never
 * a dead link.
 */
export function notificationLink(
  role: AccessRole | undefined,
  relatedJobId: string | null | undefined,
): string {
  const driver = role === "driver";
  if (relatedJobId)
    return driver
      ? `/driver/jobs/${relatedJobId}`
      : `/dispatcher/jobs/${relatedJobId}`;
  return driver ? "/driver/jobs" : "/dispatcher/dashboard";
}

/**
 * Notifications about one job collapse onto a single phone notification rather
 * than stacking: a driver assigned a job that is then rescheduled should see
 * the current state, not a pile. Everything else stays distinct.
 */
export function notificationTag(
  id: string,
  relatedJobId: string | null | undefined,
): string {
  return relatedJobId ? `job-${relatedJobId}` : `notification-${id}`;
}
