import { describe, expect, it } from "vitest";
import { openPlacementForJob, pickupTiming } from "./pickups";
import type { ContainerPlacement } from "./types";

const placement = (patch: Partial<ContainerPlacement> = {}): ContainerPlacement => ({
  id: "p1",
  customerId: "c1",
  dumpsterId: "d1",
  address: "200 E. Harmon Ave",
  deliveredJobId: "j1",
  retrievedJobId: null,
  deliveredAt: "2026-10-13T17:00:00Z",
  retrievedAt: null,
  notes: "",
  ...patch,
});

describe("pickupTiming", () => {
  const now = "2026-10-16T19:00:00Z";
  it("is unscheduled without a date", () => {
    expect(pickupTiming(placement(), now)).toBe("unscheduled");
  });
  it("is today on the pickup day, overdue after, upcoming before", () => {
    expect(pickupTiming(placement({ expectedPickupAt: "2026-10-16T19:00:00Z" }), now)).toBe("today");
    expect(pickupTiming(placement({ expectedPickupAt: "2026-10-15T19:00:00Z" }), now)).toBe("overdue");
    expect(pickupTiming(placement({ expectedPickupAt: "2026-10-17T19:00:00Z" }), now)).toBe("upcoming");
  });
});

describe("openPlacementForJob", () => {
  it("finds the open rental only for a completed delivery", () => {
    const rows = [placement()];
    expect(openPlacementForJob({ id: "j1", status: "complete" }, rows)).toBe(rows[0]);
    expect(openPlacementForJob({ id: "j1", status: "pending" }, rows)).toBeUndefined();
    expect(openPlacementForJob({ id: "j1", status: "complete" }, [placement({ retrievedAt: "2026-10-16T20:00:00Z" })])).toBeUndefined();
  });
});
