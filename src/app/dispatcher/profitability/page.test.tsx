import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfitabilityPage from "./page";
import type { User } from "@/lib/types";

const admin = { id: "austin", accessRole: "admin", permissionOverrides: {} } as unknown as User;
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({ currentUser: admin }),
}));
const toastValue = { toast: () => {} };
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => toastValue }));
vi.mock("@/components/dispatcher/Topbar", () => ({ Topbar: () => null }));
vi.mock("@/components/management/CostSettingsPanel", () => ({ CostSettingsPanel: () => null }));
// Stands in for the costs form: shows which job it was opened for.
vi.mock("@/components/management/JobCostModal", () => ({
  JobCostModal: ({ row }: { row: { reference: string } | null }) =>
    row ? <div role="dialog">Costs for {row.reference}</div> : null,
}));

const row = (overrides: Record<string, unknown>) => ({
  job_id: "job",
  reference: "#0",
  completed_at: "2026-10-13T19:00:00Z",
  invoiced_at: null,
  customer_id: "cust",
  customer_name: "Customer",
  dumpster_size: "20 Yard",
  service_type: "Delivery",
  dumpster_code: "20001",
  revenue_cents: 0,
  received_cents: 0,
  invoiced: false,
  dump_fee_cents: 13400,
  dump_source: "estimated",
  route_miles: 20,
  fuel_cents: 2800,
  fuel_source: "estimated",
  labor_cents: 5200,
  labor_source: "estimated",
  other_cents: 0,
  ...overrides,
});
// Production on 2026-10-26: #1067 invoiced, #1065 completed 10/18 and not yet.
const rows = [
  row({ job_id: "j1067", reference: "#1067", customer_name: "Mike Bianco", invoiced: true, invoiced_at: "2026-10-13T20:00:00Z", revenue_cents: 42500, received_cents: 42500 }),
  row({ job_id: "j1065", reference: "#1065", customer_name: "John Evans", completed_at: "2026-10-18T16:07:56Z" }),
];
const rpc = vi.fn(() => Promise.resolve({ data: rows, error: null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

describe("ProfitabilityPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T17:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists a completed job that is not invoiced yet as a button that opens its costs", async () => {
    render(<ProfitabilityPage />);
    const button = await screen.findByRole("button", { name: "#1065: John Evans" });
    expect(screen.getByText(/1 job completed in this period hasn't been invoiced yet/)).toBeInTheDocument();
    // Counted by invoice date, #1065 is not in the jobs table, so the button is the way in.
    expect(screen.getByText("Jobs (1)")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toHaveTextContent("Costs for #1065");
  });
});
