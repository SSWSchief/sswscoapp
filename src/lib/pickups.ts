import type { ContainerPlacement, Job } from "./types";
import { pacificDate } from "./time-clock";

export type PickupTiming = "overdue" | "today" | "upcoming" | "unscheduled";

/** The rental a delivery opened, while its can is still at the jobsite. */
export function openPlacementForJob(
  job: Pick<Job, "id" | "status">,
  placements: ContainerPlacement[],
) {
  if (job.status !== "complete") return undefined;
  return placements.find(
    (placement) =>
      placement.deliveredJobId === job.id && !placement.retrievedAt,
  );
}

/** Where a rental's pickup stands against today's Pacific business date. */
export function pickupTiming(
  placement: Pick<ContainerPlacement, "expectedPickupAt">,
  now: Date | string = new Date(),
): PickupTiming {
  if (!placement.expectedPickupAt) return "unscheduled";
  const due = pacificDate(placement.expectedPickupAt);
  const today = pacificDate(now);
  if (due < today) return "overdue";
  return due === today ? "today" : "upcoming";
}
