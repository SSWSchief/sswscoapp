import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeRequestModal } from "./TimeRequestModal";
import type { TimeEntry } from "@/lib/types";
import { pacificDate, pacificInstant } from "@/lib/time-clock";

const state = {
  myRecentTimeEntries: [] as TimeEntry[],
  created: [] as Record<string, unknown>[],
};

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({
    myRecentTimeEntries: state.myRecentTimeEntries,
    canMutate: true,
    createTimeRequest: async (input: Record<string, unknown>) => {
      state.created.push(input);
      return { ok: true, data: undefined };
    },
  }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: () => {} }),
}));

// Fixtures are built on the Pacific clock, the same one the component reads
// and writes on, so the suite behaves identically on a Pacific laptop and a
// UTC CI runner. Building them from the device clock is what made these tests
// pass locally and fail in CI.
const today = () => pacificDate(new Date());
const at = (hour: number, minute: number) =>
  pacificInstant(
    today(),
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  ) as string;

describe("TimeRequestModal — fixing hours", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.myRecentTimeEntries = [];
    state.created = [];
  });

  it("prefills the times already on the clock", async () => {
    state.myRecentTimeEntries = [
      { id: "in-1", userId: "u1", type: "clock_in", at: at(8, 47) },
      { id: "out-1", userId: "u1", type: "clock_out", at: at(16, 2) },
    ];
    render(<TimeRequestModal open kind="edit_time" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Started at/i)).toHaveValue("08:47"),
    );
    expect(screen.getByLabelText(/Finished at/i)).toHaveValue("16:02");
  });

  it("corrects an existing punch against its own entry", async () => {
    state.myRecentTimeEntries = [
      { id: "in-1", userId: "u1", type: "clock_in", at: at(9, 15) },
    ];
    render(<TimeRequestModal open kind="edit_time" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Started at/i)).toHaveValue("09:15"),
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Started at/i));
    await user.type(screen.getByLabelText(/Started at/i), "08:00");
    await user.type(screen.getByLabelText(/Reason/i), "Clocked in late by mistake");
    await user.click(screen.getByRole("button", { name: /Submit Request/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({
      kind: "edit_time",
      targetEntryId: "in-1",
      requestedEntryType: "clock_in",
    });
  });

  it("files a punch that was never made with no target to correct", async () => {
    // The case that sent Matthew to text his hours instead: he clocked in but
    // never clocked out, so there was no entry to select and no way through.
    state.myRecentTimeEntries = [
      { id: "in-1", userId: "u1", type: "clock_in", at: at(8, 0) },
    ];
    render(<TimeRequestModal open kind="edit_time" onClose={() => {}} />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByLabelText(/Finished at/i)).toHaveValue(""),
    );
    await user.type(screen.getByLabelText(/Finished at/i), "11:30");
    await user.type(screen.getByLabelText(/Reason/i), "Forgot to clock out");
    await user.click(screen.getByRole("button", { name: /Submit Request/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({
      kind: "edit_time",
      targetEntryId: null,
      requestedEntryType: "clock_out",
    });
  });

  it("files both punches when the whole shift was wrong", async () => {
    state.myRecentTimeEntries = [
      { id: "in-1", userId: "u1", type: "clock_in", at: at(9, 0) },
      { id: "out-1", userId: "u1", type: "clock_out", at: at(12, 0) },
    ];
    render(<TimeRequestModal open kind="edit_time" onClose={() => {}} />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByLabelText(/Started at/i)).toHaveValue("09:00"),
    );
    await user.clear(screen.getByLabelText(/Started at/i));
    await user.type(screen.getByLabelText(/Started at/i), "08:00");
    await user.clear(screen.getByLabelText(/Finished at/i));
    await user.type(screen.getByLabelText(/Finished at/i), "11:30");
    await user.type(screen.getByLabelText(/Reason/i), "Both times were wrong");
    await user.click(screen.getByRole("button", { name: /Submit Request/i }));

    await waitFor(() => expect(state.created).toHaveLength(2));
    expect(state.created.map((r) => r.requestedEntryType)).toEqual([
      "clock_in",
      "clock_out",
    ]);
  });

  it("does not resubmit a punch that was already right", async () => {
    state.myRecentTimeEntries = [
      { id: "in-1", userId: "u1", type: "clock_in", at: at(8, 0) },
      { id: "out-1", userId: "u1", type: "clock_out", at: at(12, 0) },
    ];
    render(<TimeRequestModal open kind="edit_time" onClose={() => {}} />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByLabelText(/Finished at/i)).toHaveValue("12:00"),
    );
    await user.clear(screen.getByLabelText(/Finished at/i));
    await user.type(screen.getByLabelText(/Finished at/i), "11:30");
    await user.type(screen.getByLabelText(/Reason/i), "Left early");
    await user.click(screen.getByRole("button", { name: /Submit Request/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({ requestedEntryType: "clock_out" });
  });
});
