import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingDataPanel } from "./TrainingDataPanel";

const mocks = vi.hoisted(() => ({
  expanded: vi.fn(),
  operations: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: mocks.expanded,
}));
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: mocks.operations,
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

describe("TrainingDataPanel", () => {
  const provision = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations.mockReturnValue({ canMutate: true });
    mocks.expanded.mockReturnValue({
      trainingDataset: {
        datasetKey: "training-v1",
        status: "not_provisioned",
        recordIds: {},
      },
      provisionTrainingDataset: provision,
      removeTrainingDataset: remove,
    });
  });

  afterEach(() => cleanup());

  it("provisions the single controlled dataset", async () => {
    provision.mockResolvedValue({
      ok: true,
      data: { status: "active", idempotent: false },
    });
    render(<TrainingDataPanel />);
    expect(screen.getByText("TRAINING-TRUCK-01")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Create Training Data" }),
    );
    expect(provision).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith("Training data created.", {
      tone: "success",
    });
  });

  it("requires the exact phrase before removing registered records", async () => {
    remove.mockResolvedValue({
      ok: true,
      data: { status: "removed", idempotent: false },
    });
    mocks.expanded.mockReturnValue({
      trainingDataset: {
        datasetKey: "training-v1",
        status: "active",
        recordIds: { jobId: "training-v1-job" },
      },
      provisionTrainingDataset: provision,
      removeTrainingDataset: remove,
    });
    const user = userEvent.setup();
    render(<TrainingDataPanel />);
    await user.click(
      screen.getByRole("button", { name: "Remove Training Data" }),
    );
    const submit = screen.getByRole("button", {
      name: "Remove All Five Records",
    });
    expect(submit).toBeDisabled();
    await user.type(
      screen.getByLabelText(/Type DELETE TRAINING DATA/),
      "DELETE TRAINING DATA",
    );
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(remove).toHaveBeenCalledWith("training-v1");
    expect(mocks.toast).toHaveBeenCalledWith("Training data removed.", {
      tone: "success",
    });
  });

  it("surfaces provisioning failures without changing data", async () => {
    provision.mockResolvedValue({
      ok: false,
      error: { code: "forbidden", message: "Administrator access required" },
    });
    render(<TrainingDataPanel />);
    await userEvent.click(
      screen.getByRole("button", { name: "Create Training Data" }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      "Administrator access required",
      { tone: "error" },
    );
  });
});
