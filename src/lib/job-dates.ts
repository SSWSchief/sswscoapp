import type { Job } from "./types";
import { pacificDate } from "./time-clock";

export type DriverJobWindow = "today" | "upcoming";

export function jobsForPacificDay(
  jobs: Job[],
  date: Date | string = new Date(),
) {
  const day = pacificDate(date);
  return jobs.filter((job) => pacificDate(job.scheduledFor) === day);
}

export function driverJobsForWindow(
  jobs: Job[],
  driverId: string,
  window: DriverJobWindow,
  now: Date | string = new Date(),
) {
  const day = pacificDate(now);
  return jobs
    .filter(
      (job) =>
        job.assignedDriverId === driverId &&
        job.status !== "cancelled" &&
        (window === "today"
          ? pacificDate(job.scheduledFor) === day
          : pacificDate(job.scheduledFor) > day),
    )
    .sort(
      (a, b) =>
        a.scheduledFor.localeCompare(b.scheduledFor) ||
        a.reference.localeCompare(b.reference),
    );
}
