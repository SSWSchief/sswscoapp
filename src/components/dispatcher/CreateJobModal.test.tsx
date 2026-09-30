import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateJobModal } from "./CreateJobModal";
import type {
  ContainerPlacement,
  Customer,
  Dumpster,
  Job,
  Truck,
  User,
} from "@/lib/types";

const state = {
  created: [] as Record<string, unknown>[],
  customers: [] as Customer[],
};

const customers = [
  { id: "cust-1", name: "Vegas GC", phone: "702-555-0100", address: "1 A St" },
] as Customer[];
const users = [
  { id: "rep-1", fullName: "Annie Montoya", status: "active", accessRole: "dispatcher" },
  { id: "drv-1", fullName: "Matthew Hicks", status: "active", accessRole: "driver" },
] as User[];
const trucks = [
  {
    id: "truck-1",
    number: "T-01",
    type: "Roll-off Truck",
    status: "in_use",
    licensePlate: "NV-123",
    assignedDriverId: null,
    currentJobId: null,
    notes: "",
  },
] as Truck[];
const dumpster = (id: string, code: string, currentJobId: string | null = null) =>
  ({ id, code, size: "20 Yard", status: "in_yard", type: "Roll-off", currentJobId, currentLocation: "Yard", airTagId: null, notes: "" }) as unknown as Dumpster;
// 20001 is out at Vegas GC on a completed delivery; 20002 and 40001 are home,
// and 40001 is still loaded on a job that is under way.
const dumpsters = [
  dumpster("can-1", "20001", "job-delivered"),
  dumpster("can-2", "20002"),
  dumpster("can-3", "40001", "job-rolling"),
];
const openPlacements = [
  {
    id: "placement-1",
    customerId: "cust-1",
    dumpsterId: "can-1",
    address: "1 A St",
    deliveredJobId: "job-delivered",
    retrievedJobId: null,
    deliveredAt: "2026-09-17T17:37:00Z",
    retrievedAt: null,
    notes: "",
  },
] as ContainerPlacement[];
const jobs = [
  { id: "job-delivered", status: "complete" },
  { id: "job-rolling", status: "en_route" },
] as Job[];

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({
    customers: state.customers,
    users,
    dumpsters,
    openPlacements,
    jobs,
    trucks,
    canMutate: true,
    createJob: async (input: Record<string, unknown>) => {
      state.created.push(input);
      return { ok: true, data: {} };
    },
    updateJob: async () => ({ ok: true, data: undefined }),
    saveTruck: async () => ({ ok: true, data: undefined }),
  }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: () => {} }),
}));

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText(/Enter address/i), "500 Sahara Ave");
  await user.selectOptions(screen.getByLabelText(/Service Type/i), "Delivery");
  await user.selectOptions(screen.getByLabelText(/Dumpster Size/i), "20 Yard");
  await user.type(screen.getByLabelText(/Scheduled Date/i), "2026-09-10");
};

describe("CreateJobModal — booking a customer who is not on the list", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.created = [];
    state.customers = customers;
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

  it("edits the selected truck without discarding the work order", async () => {
    const view = render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Vegas GC");
    await user.type(screen.getByPlaceholderText(/Enter address/i), "500 Sahara Ave");
    await user.selectOptions(screen.getByLabelText(/Assign Truck/i), "truck-1");

    await user.click(screen.getByRole("button", { name: "Edit T-01" }));
    expect(screen.getByRole("dialog", { name: "Edit Truck" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Truck Number/i)).toHaveValue("T-01");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("dialog", { name: "Create New Job" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Customer/i)).toHaveValue("Vegas GC");
    expect(screen.getByPlaceholderText(/Enter address/i)).toHaveValue(
      "500 Sahara Ave",
    );
    expect(screen.getByLabelText(/Assign Truck/i)).toHaveValue("truck-1");

    // A successful truck save refreshes every work-order domain. New array
    // identities must not be mistaken for a request to initialize the form.
    state.customers = [...customers];
    view.rerender(<CreateJobModal open onClose={() => {}} />);
    expect(screen.getByLabelText(/^Customer/i)).toHaveValue("Vegas GC");
    expect(screen.getByPlaceholderText(/Enter address/i)).toHaveValue(
      "500 Sahara Ave",
    );
  });
});

describe("CreateJobModal — schedule time", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.created = [];
    state.customers = customers;
  });

  it("books a date alone at the default time", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Vegas GC");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({ scheduledFor: "2026-09-10T08:00" });
  });

  it("takes a time set before or after the date", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Vegas GC");
    const time = screen.getByLabelText(/^Time/);
    await user.clear(time);
    await user.type(time, "13:30");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /Save Job/i }));

    await waitFor(() => expect(state.created).toHaveLength(1));
    expect(state.created[0]).toMatchObject({ scheduledFor: "2026-09-10T13:30" });
  });
});

describe("CreateJobModal — which dumpster", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.created = [];
    state.customers = customers;
  });

  const optionLabels = () =>
    Array.from(
      (screen.getByLabelText(/Assign Dumpster/i) as HTMLSelectElement).options,
    ).map((option) => ({ label: option.textContent, disabled: option.disabled }));

  it("offers a pick-up only the can on site for that customer, pre-filled", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Customer/i), "Vegas GC");
    await user.selectOptions(screen.getByLabelText(/Service Type/i), "Pick-Up");

    expect(optionLabels().map((option) => option.label)).toEqual([
      "No dumpster",
      "20001 · 20 Yard at 1 A St",
    ]);
    expect(screen.getByLabelText(/Assign Dumpster/i)).toHaveValue("can-1");
    // The site address comes along when none was typed.
    expect(screen.getByPlaceholderText(/Enter address/i)).toHaveValue("1 A St");
  });

  it("keeps a can that is out on a rental off a delivery", async () => {
    render(<CreateJobModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Service Type/i), "Delivery");

    expect(optionLabels()).toEqual([
      { label: "No dumpster", disabled: false },
      { label: "20001 · 20 Yard (On site)", disabled: true },
      { label: "20002 · 20 Yard", disabled: false },
      { label: "40001 · 20 Yard (Active job)", disabled: true },
    ]);
  });
});
