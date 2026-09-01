import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateJobModal } from "./CreateJobModal";
import type { Customer, User } from "@/lib/types";

const state = { created: [] as Record<string, unknown>[] };

const customers = [
  { id: "cust-1", name: "Vegas GC", phone: "702-555-0100", address: "1 A St" },
] as Customer[];
const users = [
  { id: "rep-1", fullName: "Annie Montoya", status: "active", accessRole: "dispatcher" },
  { id: "drv-1", fullName: "Matthew Hicks", status: "active", accessRole: "driver" },
] as User[];

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({
    customers,
    users,
    dumpsters: [],
    trucks: [],
    canMutate: true,
    createJob: async (input: Record<string, unknown>) => {
      state.created.push(input);
      return { ok: true, data: {} };
    },
    updateJob: async () => ({ ok: true, data: undefined }),
  }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: () => {} }),
}));

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText(/Enter address/i), "500 Sahara Ave");
  await user.selectOptions(screen.getByLabelText(/Service Type/i), "Delivery");
  await user.selectOptions(screen.getByLabelText(/Dumpster Size/i), "20 Yard");
  await user.type(screen.getByLabelText(/Scheduled/i), "2026-09-10T09:00");
};

describe("CreateJobModal — booking a customer who is not on the list", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.created = [];
  });

  it("sends a typed name for the server to resolve or create", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Brand New Builders");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({
      customerId: "",
      customerName: "Brand New Builders",
    });
  });

  it("reuses an existing customer even when the name is typed in a different case", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "vegas gc");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    // Matched, so no second "Vegas GC" is created and the phone comes along.
    expect(state.created[0]).toMatchObject({
      customerId: "cust-1",
      customerName: "",
      phone: "702-555-0100",
    });
  });

  it("records the representative who brought in the job", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Vegas GC");
    await user.selectOptions(screen.getByLabelText(/Sales Rep/i), "rep-1");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({ salesRepId: "rep-1" });
  });

  it("shows no asterisk on Customer but still requires one", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const field = screen.getByLabelText(/^Customer/i);
    // Dispatch read the asterisk as "pick from this list only". It is gone,
    // while the control stays required for assistive technology.
    expect(field).toHaveAttribute("aria-required", "true");
    const label = screen.getByText("Customer", { selector: "label" });
    expect(label.textContent).not.toContain("*");
  });

  it("still refuses a job with no customer at all", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    expect(
      await screen.findByText(/Pick a customer or type a new name/i),
    ).toBeInTheDocument();
    expect(state.created).toHaveLength(0);
  });
});
