import { describe, expect, it } from "vitest";
import { daysOnSite, netTons, producesDisposalTicket } from "./measures";

describe("netTons", () => {
  it("converts pounds to tons at two decimals", () => {
    expect(netTons(8000)).toBe(4);
    expect(netTons(9340)).toBe(4.67);
  });

  it("treats missing or nonsensical weights as nothing to bill", () => {
    expect(netTons(0)).toBe(0);
    expect(netTons(-500)).toBe(0);
    expect(netTons(Number.NaN)).toBe(0);
  });
});

describe("daysOnSite", () => {
  it("counts the delivery day as day one", () => {
    expect(
      daysOnSite("2026-09-01T15:00:00Z", "2026-09-01T22:00:00Z"),
    ).toBe(1);
  });

  it("counts calendar days, not elapsed hours", () => {
    // Dropped 6pm Monday Pacific, pulled 8am Tuesday: two days, not one.
    expect(
      daysOnSite("2026-09-01T01:00:00Z", "2026-09-01T15:00:00Z"),
    ).toBe(2);
  });

  it("spans a full included week", () => {
    expect(
      daysOnSite("2026-09-01T17:00:00Z", "2026-09-07T17:00:00Z"),
    ).toBe(7);
  });

  it("measures an open placement against the moment asked", () => {
    expect(
      daysOnSite("2026-09-01T17:00:00Z", null, "America/Los_Angeles", "2026-09-10T17:00:00Z"),
    ).toBe(10);
  });

  it("never returns a negative span", () => {
    expect(
      daysOnSite("2026-09-10T17:00:00Z", "2026-09-01T17:00:00Z"),
    ).toBe(0);
  });
});

describe("producesDisposalTicket", () => {
  it("is true for the services that reach a disposal site", () => {
    expect(producesDisposalTicket("Pick-Up")).toBe(true);
    expect(producesDisposalTicket("Dump & Return")).toBe(true);
    expect(producesDisposalTicket("Swap / Exchange")).toBe(true);
  });

  it("is false for services that never carry a load", () => {
    expect(producesDisposalTicket("Delivery")).toBe(false);
    expect(producesDisposalTicket("Relocation")).toBe(false);
    expect(producesDisposalTicket("Dry Run")).toBe(false);
    expect(producesDisposalTicket("Service Call")).toBe(false);
  });
});
