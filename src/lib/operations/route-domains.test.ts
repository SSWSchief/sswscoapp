import { describe, expect, it } from "vitest";
import {
  coreDomainsForPath,
  detailEmployeeId,
  detailJobId,
  detailTruckId,
  expandedDomainsForPath,
} from "./route-domains";

describe("route domain selection", () => {
  it("keeps public data boundaries narrow", () => {
    expect([...coreDomainsForPath("/dispatcher/customers")]).toEqual([
      "notifications",
      "customers",
    ]);
    expect([...expandedDomainsForPath("/dispatcher/customers")]).toEqual([
      "messaging",
    ]);
  });

  it("loads only job dependencies for job details", () => {
    expect(coreDomainsForPath("/driver/jobs/job-123")).toEqual(
      new Set(["notifications", "jobs", "customers", "fleet", "people"]),
    );
    expect(detailJobId("/driver/jobs/job-123")).toBe("job-123");
  });

  it("loads dashboard summary domains", () => {
    expect(coreDomainsForPath("/dispatcher/dashboard").size).toBe(7);
    expect(expandedDomainsForPath("/dispatcher/dashboard")).toEqual(
      new Set(["messaging", "finance", "compliance"]),
    );
  });

  it.each([
    ["/management", ["finance", "messaging", "compliance", "settings"]],
    ["/dispatcher/messages", ["messaging"]],
    ["/driver/messages", ["messaging"]],
    ["/dispatcher/invoices", ["messaging", "finance"]],
    ["/dispatcher/reports", ["messaging", "finance"]],
    ["/driver/pre-trip", ["messaging", "compliance"]],
    ["/driver/sops", ["messaging", "compliance"]],
    ["/driver/profile", ["messaging", "settings"]],
    // Settings also loads finance: the pricing tab reads the rate card.
    ["/dispatcher/settings", ["messaging", "compliance", "settings", "finance"]],
  ])("selects expanded domains for %s", (path, expected) => {
    expect([...expandedDomainsForPath(path)]).toEqual(expected);
  });

  it.each([
    ["/dispatcher/trucks", ["notifications", "fleet", "jobs", "people"]],
    // Customers ride along so the On Site panel can name who each open
    // rental is standing with.
    ["/dispatcher/dumpsters", ["notifications", "fleet", "customers"]],
    ["/dispatcher/map", ["notifications", "jobs", "customers", "fleet"]],
    ["/dispatcher/time-clock", ["notifications", "time", "people"]],
    ["/dispatcher/absence-calendar", ["notifications", "time", "people"]],
    ["/dispatcher/employees", ["notifications", "people"]],
    ["/dispatcher/invoices", ["notifications", "customers"]],
    ["/driver/profile", ["notifications", "fleet"]],
  ])("selects core dependencies for %s", (path, expected) => {
    expect([...coreDomainsForPath(path)]).toEqual(expected);
  });

  it("does not parse list routes as job detail IDs", () => {
    expect(detailJobId("/dispatcher/jobs")).toBeNull();
  });

  it("identifies directly requested employee and truck records", () => {
    expect(detailEmployeeId("/dispatcher/employees/employee%201")).toBe(
      "employee 1",
    );
    expect(detailTruckId("/dispatcher/trucks/truck-1")).toBe("truck-1");
    expect(detailEmployeeId("/dispatcher/employees")).toBeNull();
    expect(detailTruckId("/dispatcher/trucks")).toBeNull();
  });
});
