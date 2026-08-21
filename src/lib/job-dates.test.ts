import { describe, expect, it } from "vitest";
import {
  driverJobsForWindow,
  jobsForPacificDay,
  loadedJobWindow,
} from "./job-dates";
import type { Job } from "./types";
const job = (
  id: string,
  scheduledFor: string,
  status: Job["status"] = "pending",
): Job => ({
  id,
  reference: `#${id}`,
  customerId: "c",
  address: "a",
  phone: "",
  serviceType: "Delivery",
  dumpsterSize: "10 Yard",
  assignedDriverId: "d",
  assignedTruckId: null,
  assignedDumpsterId: null,
  scheduledFor,
  status,
  notes: "",
  photos: [],
  timeline: [],
});
describe("Pacific job windows", () => {
  it("uses the business day at UTC boundaries", () =>
    expect(
      jobsForPacificDay(
        [job("1", "2026-08-07T06:30:00Z")],
        "2026-08-06T20:00:00-07:00",
      ),
    ).toHaveLength(1));
  it("separates upcoming and excludes cancelled", () =>
    expect(
      driverJobsForWindow(
        [
          job("1", "2026-08-06T18:00:00Z"),
          job("2", "2026-08-07T18:00:00Z"),
          job("3", "2026-08-08T18:00:00Z", "cancelled"),
        ],
        "d",
        "upcoming",
        "2026-08-06T12:00:00-07:00",
      ).map((j) => j.id),
    ).toEqual(["2"]));
});

describe("the loaded job window", () => {
  const now = "2026-08-16T12:00:00-07:00";

  it("always contains today, however much history exists", () => {
    // The regression this guards: jobs were loaded oldest-first with no date
    // bound, so once fifty jobs had been run, today fell outside the loaded set
    // and every screen reported no work while trucks were rolling.
    const { start, end } = loadedJobWindow(now);
    const today = Date.parse("2026-08-16T09:00:00-07:00");
    expect(Date.parse(start)).toBeLessThanOrEqual(today);
    expect(Date.parse(end)).toBeGreaterThan(today);
  });

  it("reaches back over the Reports default lookback", () => {
    const { start } = loadedJobWindow(now);
    const aWeekAgo = Date.parse("2026-08-10T12:00:00-07:00");
    expect(Date.parse(start)).toBeLessThan(aWeekAgo);
  });

  it("reaches forward for scheduling and drivers' upcoming work", () => {
    const { end } = loadedJobWindow(now);
    const nextMonth = Date.parse("2026-09-16T12:00:00-07:00");
    expect(Date.parse(end)).toBeGreaterThan(nextMonth);
  });

  it("moves with the clock rather than anchoring to history", () => {
    const august = loadedJobWindow("2026-08-16T12:00:00-07:00");
    const december = loadedJobWindow("2026-12-16T12:00:00-07:00");
    expect(Date.parse(december.start)).toBeGreaterThan(Date.parse(august.start));
    expect(Date.parse(december.end)).toBeGreaterThan(Date.parse(august.end));
  });
});
