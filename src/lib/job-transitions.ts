import type { JobStatus } from "./types";

export const validJobTransitions: Record<JobStatus, readonly JobStatus[]> = {
  pending: ["en_route", "cancelled"],
  en_route: ["arrived", "cancelled"],
  arrived: ["complete", "cancelled"],
  complete: [],
  cancelled: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus) { return validJobTransitions[from].includes(to); }
