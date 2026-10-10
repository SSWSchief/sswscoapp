import type { JobStatus } from "./types";

const validJobTransitions: Record<JobStatus, readonly JobStatus[]> = {
  pending: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["complete", "cancelled"],
  complete: [],
  cancelled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return validJobTransitions[from].includes(to);
}

export type ManualAdvanceTarget = "en_route" | "arrived" | "complete";

/**
 * The statuses the office can move an open job on to by hand. Later steps only,
 * and any of them in one go: the database fills in the steps in between, so a
 * pending job nobody drove can go straight to complete.
 */
export function manualAdvanceTargets(status: JobStatus): ManualAdvanceTarget[] {
  if (status === "pending") return ["en_route", "arrived", "complete"];
  if (status === "en_route") return ["arrived", "complete"];
  if (status === "arrived") return ["complete"];
  return [];
}
