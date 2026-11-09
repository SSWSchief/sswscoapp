import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer, Job } from "@/lib/types";

const state = { jobs: [] as Job[], customers: [] as Customer[], canMutate: true };
let rows: Record<string, unknown>[] = [];
const toast = vi.fn();
const request = vi.fn();

vi.mock("@/components/system/OperationsProvider", () => ({ useOperations: () => state }));
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/job-confirmations/client", () => ({
  requestJobConfirmation: (...args: unknown[]) => request(...args),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const chain = {
      select: () => chain,
      is: () => chain,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return { from: () => chain };
  },
}));

const { UnsentConfirmations } = await import("./UnsentConfirmations");

const job = (overrides: Partial<Job>): Job =>
  ({
    id: "job-1",
    reference: "#1070",
    customerId: "cust-1",
    status: "pending",
    scheduledFor: "2026-11-09T16:00:00Z",
    ...overrides,
  }) as Job;

describe("UnsentConfirmations", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T18:00:00Z"));
    state.customers = [{ id: "cust-1", name: "John Evans" } as Customer];
    state.jobs = [job({})];
    rows = [{ job_id: "job-1", recipient_email: "john@example.com", send_error: "Email was not accepted (403)" }];
    toast.mockReset();
    request.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("lists an upcoming job whose confirmation never went out", async () => {
    render(<UnsentConfirmations />);
    expect(await screen.findByText("Confirmation Emails Not Sent")).toBeInTheDocument();
    expect(screen.getByText(/#1070 · John Evans/)).toBeInTheDocument();
    expect(screen.getByText(/To john@example.com · Email was not accepted/)).toBeInTheDocument();
  });

  it("shows nothing when every upcoming confirmation went out", async () => {
    rows = [];
    const { container } = render(<UnsentConfirmations />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("ignores past, cancelled and completed jobs", async () => {
    state.jobs = [job({ scheduledFor: "2026-11-07T16:00:00Z" })];
    const { container, rerender } = render(<UnsentConfirmations />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    for (const status of ["cancelled", "complete"] as const) {
      state.jobs = [job({ status })];
      rerender(<UnsentConfirmations />);
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    }
  });

  it("sends again to the same address and says so", async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    render(<UnsentConfirmations />);
    fireEvent.click(await screen.findByRole("button", { name: "Send again" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Confirmation sent to john@example.com.", { tone: "success" }));
    expect(request).toHaveBeenCalledWith("job-1", "john@example.com");
  });

  it("reports why a second try still failed", async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Email not sent: verify sswsco.com" } }), { status: 502 }),
    );
    render(<UnsentConfirmations />);
    fireEvent.click(await screen.findByRole("button", { name: "Send again" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Still not sent: Email not sent: verify sswsco.com", { tone: "error" }),
    );
  });
});
