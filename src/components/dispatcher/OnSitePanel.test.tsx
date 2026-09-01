import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnSitePanel } from "./OnSitePanel";
import type { ContainerPlacement, Customer, Dumpster } from "@/lib/types";

const state = {
  openPlacements: [] as ContainerPlacement[],
  dumpsters: [] as Dumpster[],
  customers: [] as Customer[],
};

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => state,
}));

const placement = (
  overrides: Partial<ContainerPlacement> & { id: string },
): ContainerPlacement => ({
  customerId: "cust-1",
  dumpsterId: "can-1",
  address: "100 Sahara Ave",
  deliveredJobId: null,
  retrievedJobId: null,
  deliveredAt: "2026-08-25T17:00:00Z",
  retrievedAt: null,
  notes: "",
  ...overrides,
});

describe("OnSitePanel", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T17:00:00Z"));
    state.openPlacements = [];
    state.dumpsters = [
      { code: "SSWS-14" } as Dumpster,
      { code: "SSWS-22" } as Dumpster,
    ].map((item, index) => ({ ...item, id: `can-${index + 1}` }) as Dumpster);
    state.customers = [
      { id: "cust-1", name: "Vegas GC" } as Customer,
      { id: "cust-2", name: "Reno Builders" } as Customer,
    ];
  });
  afterEach(() => vi.useRealTimers());

  it("says nothing is out when no rental is open", () => {
    render(<OnSitePanel />);
    expect(screen.getByText(/No containers are out/)).toBeInTheDocument();
  });

  it("counts days from the delivery date, inclusive", () => {
    state.openPlacements = [placement({ id: "p1" })];
    render(<OnSitePanel />);
    // Delivered 25 Aug, now 1 Sep: eight calendar days including the first.
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vegas GC").length).toBeGreaterThan(0);
    expect(screen.getByText("1 container out")).toBeInTheDocument();
  });

  it("puts the longest-standing rental first", () => {
    state.openPlacements = [
      placement({ id: "recent", deliveredAt: "2026-08-31T17:00:00Z" }),
      placement({
        id: "old",
        dumpsterId: "can-2",
        customerId: "cust-2",
        deliveredAt: "2026-08-01T17:00:00Z",
      }),
    ];
    render(<OnSitePanel />);
    const table = screen.getByRole("table");
    const firstRow = within(table).getAllByRole("row")[1];
    expect(within(firstRow).getByText("SSWS-22")).toBeInTheDocument();
    expect(screen.getByText("2 containers out")).toBeInTheDocument();
  });

  it("does not pretend to know a missing customer", () => {
    state.openPlacements = [placement({ id: "p1", customerId: "gone" })];
    render(<OnSitePanel />);
    expect(screen.getAllByText("Unknown customer").length).toBeGreaterThan(0);
  });
});
