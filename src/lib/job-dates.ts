import type { Job } from "./types";
import { pacificDate, pacificDayEnd, pacificDayStart } from "./time-clock";

/** Days of finished work kept loaded — covers the Reports default lookback. */
const DAYS_BEHIND = 30;
/** Days of scheduled work kept loaded, for dispatch and drivers' upcoming. */
const DAYS_AHEAD = 90;

/**
 * The span of jobs the app keeps in memory.
 *
 * Every screen filters this one array client-side, so whatever it excludes is
 * invisible everywhere. It was previously the fifty oldest jobs ever scheduled
 * — no date bound at all — which meant that once the company had run fifty
 * jobs, "today" fell outside the loaded set and the dashboard reported no work
 * while trucks were rolling. Anchoring the window to now instead of to the
 * start of history keeps today present no matter how much history accumulates.
 *
 * Older work is still reachable: a job opened directly by URL is fetched on its
 * own, and Reports exports query the database over the requested range rather
 * than this array.
 */
export function loadedJobWindow(now: Date | string = new Date()) {
  const at = typeof now === "string" ? Date.parse(now) : now.getTime();
  return {
    start: pacificDayStart(pacificDate(new Date(at - DAYS_BEHIND * 86400000))),
    end: pacificDayEnd(pacificDate(new Date(at + DAYS_AHEAD * 86400000))),
  };
}

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
