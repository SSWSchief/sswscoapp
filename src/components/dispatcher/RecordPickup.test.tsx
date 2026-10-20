import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordPickupButton } from "./RecordPickup";
import type { ContainerPlacement, User } from "@/lib/types";

const refresh = vi.fn(async () => {});
const operations = {
  currentUser: null as User | null,
  canMutate: true,
  refresh,
};
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => operations,
}));
const toasts: string[] = [];
const toastValue = { toast: (message: string) => { toasts.push(message); } };
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => toastValue }));
type RpcResult = { data: object; error: { message: string } | null };
const rpc = vi.fn<(name: string, args: unknown) => Promise<RpcResult>>(async () => ({ data: {}, error: null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

const placement: ContainerPlacement = {
  id: "placement-20001",
  customerId: "cust-1",
  dumpsterId: "can-20001",
  address: "9255 Jade Lagoon Street",
  deliveredJobId: "job-1067",
  retrievedJobId: null,
  deliveredAt: "2026-10-13T19:06:49Z",
  retrievedAt: null,
  notes: "",
};
const admin = { id: "austin", accessRole: "admin", permissionOverrides: {} } as unknown as User;

describe("RecordPickupButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T16:00:00Z"));
    operations.currentUser = admin;
    rpc.mockClear();
    refresh.mockClear();
    toasts.length = 0;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is hidden from someone without the jobs permission", () => {
    operations.currentUser = { ...admin, accessRole: "driver" } as User;
    render(<RecordPickupButton placement={placement} code="20001" />);
    expect(screen.queryByText("Mark picked up")).toBeNull();
  });

  it("records the pick-up on the day chosen and reloads", async () => {
    render(<RecordPickupButton placement={placement} code="20001" />);
    fireEvent.click(screen.getByText("Mark picked up"));
    const day = screen.getByLabelText(/Day it was picked up/) as HTMLInputElement;
    expect(day.value).toBe("2026-10-20");
    expect(day.min).toBe("2026-10-13");
    fireEvent.change(day, { target: { value: "2026-10-17" } });
    fireEvent.click(screen.getByText("Back in Yard"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("record_pickup", {
      target_placement_id: "placement-20001",
      picked_up_on: "2026-10-17",
    });
    expect(toasts).toContain("20001 is back in the yard.");
  });

  it("refuses a day before delivery without calling the database", () => {
    render(<RecordPickupButton placement={placement} code="20001" />);
    fireEvent.click(screen.getByText("Mark picked up"));
    fireEvent.change(screen.getByLabelText(/Day it was picked up/), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByText("Back in Yard"));
    expect(rpc).not.toHaveBeenCalled();
    expect(toasts[0]).toMatch(/Pick a day from/);
  });

  it("shows the database's refusal", async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: { message: "A pick-up job for this dumpster is under way; complete that job instead" } });
    render(<RecordPickupButton placement={placement} code="20001" />);
    fireEvent.click(screen.getByText("Mark picked up"));
    fireEvent.click(screen.getByText("Back in Yard"));
    await waitFor(() => expect(toasts[0]).toMatch(/under way/));
    expect(refresh).not.toHaveBeenCalled();
  });
});
