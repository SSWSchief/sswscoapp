import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvoiceModal } from "./InvoiceModal";
import type { Customer, InvoiceRecord, Job } from "@/lib/types";

const customers = [
  { id: "cust-1", name: "Vegas GC", phone: "", email: "", address: "", billingContactName: "Pat", billingEmail: "pat@x.com", billingAddressLine1: "", billingAddressLine2: "", billingCity: "", billingState: "", billingPostalCode: "" },
  { id: "cust-2", name: "John Evans", phone: "7025283364", email: "jevans@example.com", address: "", billingContactName: "John Evans", billingEmail: "jevans@example.com", billingAddressLine1: "3005 Contract Avenue", billingAddressLine2: "", billingCity: "Las Vegas", billingState: "NV", billingPostalCode: "89101" },
] as Customer[];

const jobs = [
  { id: "job-1", customerId: "cust-1", status: "complete", serviceType: "Delivery", dumpsterSize: "20 Yard", reference: "J-1", address: "500 Fremont St, Las Vegas, NV 89101" },
  { id: "job-2", customerId: "cust-1", status: "complete", serviceType: "Dry Run", dumpsterSize: "40 Yard", reference: "J-2" },
] as Job[];

// Object identity matters here: InvoiceModal's setup effect depends on
// `settings`, so a mock that returns a fresh object every render would send
// it into an infinite re-render loop instead of running once per open.
const savedCustomers: unknown[] = [];
const operationsValue = {
  customers, jobs, canMutate: true,
  saveCustomer: async (input: unknown) => { savedCustomers.push(input); return { ok: true }; },
};
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => operationsValue,
}));

const saved: unknown[] = [];
const confirmCalls: Array<{ title: string; message?: string }> = [];
let confirmAnswer = true;
vi.mock("@/components/system/ConfirmProvider", () => ({
  useConfirm: () => async (options: { title: string; message?: string }) => {
    confirmCalls.push(options);
    return confirmAnswer;
  },
}));

const settings: Record<string, unknown> = { defaultPaymentTerms: "net_30" };
// Only Delivery · 20 Yard is priced — Dry Run has no rate on file, mirroring
// production where several service types are seeded for one size only.
const priceList = [{ id: "p1", serviceType: "Delivery", dumpsterSize: "20 Yard", priceCents: 40000 }];
const invoices: unknown[] = [];
const expandedOperationsValue = {
  saveInvoice: async (payload: unknown) => { saved.push(payload); return { ok: true, data: {} }; },
  settings, priceList, invoices, loading: false, priceListReady: true, refresh: async () => {},
};
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: () => expandedOperationsValue,
}));
const toasts: string[] = [];
const toast = (message: string) => { toasts.push(message); };
const toastValue = { toast };
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => toastValue }));

global.fetch = vi.fn(() => Promise.reject(new Error("no network in test"))) as unknown as typeof fetch;

describe("InvoiceModal — multi-job statement", () => {
  afterEach(() => {
    cleanup();
    saved.length = 0;
    savedCustomers.length = 0;
    confirmCalls.length = 0;
    confirmAnswer = true;
    expandedOperationsValue.loading = false;
    expandedOperationsValue.priceListReady = true;
  });

  const openStatementWithBothJobs = async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Vegas GC");
    await user.selectOptions(screen.getByLabelText(/Billing mode/i), "statement");
    const checkboxes = await screen.findAllByRole("checkbox", { name: /J-1|J-2/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    return checkboxes;
  };

  it("gives each selected job its own line item when both are priced", async () => {
    // Re-point the second job at a priced combo for this one test.
    const original = jobs[1].dumpsterSize;
    jobs[1].dumpsterSize = "20 Yard" as Job["dumpsterSize"];
    priceList.push({ id: "p2", serviceType: "Dry Run", dumpsterSize: "20 Yard", priceCents: 12500 });
    try {
      await openStatementWithBothJobs();
      const amounts = screen.getAllByLabelText(/amount/i) as HTMLInputElement[];
      expect(amounts.map((input) => input.value)).toEqual(["400.00", "125.00"]);
    } finally {
      jobs[1].dumpsterSize = original;
      priceList.pop();
    }
  });

  it("waits for the price catalog before a job can create its invoice line", async () => {
    expandedOperationsValue.loading = true;
    const view = render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Vegas GC");
    const job = screen.getByRole("radio", { name: /J-1/i });
    expect(job).toBeDisabled();
    expect(screen.getByText(/Loading preset prices/i)).toBeInTheDocument();
    expandedOperationsValue.loading = false;
    view.rerender(<InvoiceModal open onClose={() => {}} />);
    expect(job).not.toBeDisabled();
    await user.click(job);
    expect(screen.getByLabelText("Line 1 amount")).toHaveValue(400);
  });

  it("blocks job selection when the rate catalog fails to load", async () => {
    expandedOperationsValue.priceListReady = false;
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Vegas GC");
    expect(screen.getByRole("radio", { name: /J-1/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/rates could not be loaded/i);
  });

  it("still adds a line item for a job with no matching price-list rate, instead of dropping it", async () => {
    const checkboxes = await openStatementWithBothJobs();

    // Both jobs stay selected — the unpriced one isn't silently skipped.
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);

    // It gets a visible, labeled line item with a blank amount to fill in,
    // not nothing — a blank amount also keeps save() refusing until priced.
    const amounts = screen.getAllByLabelText(/amount/i) as HTMLInputElement[];
    expect(amounts.map((input) => input.value)).toEqual(["400.00", ""]);

    // The description is exactly what the customer will read on the Stripe
    // line item, so the "needs a price" signal lives beside the amount field
    // instead of inside the billed text.
    const description = screen.getByDisplayValue("Dry Run · 40 Yard · J-2");
    expect(description).toBeInTheDocument();
    expect((description as HTMLInputElement).value).not.toMatch(/no rate/i);
    expect(screen.getByText(/No rate on file — enter an amount/i)).toBeInTheDocument();
  });

  it("keeps the unpriced warning out of the description once an amount is typed", async () => {
    await openStatementWithBothJobs();
    const user = userEvent.setup();
    const amounts = screen.getAllByLabelText(/amount/i) as HTMLInputElement[];
    await user.type(amounts[1], "175.00");

    expect(screen.queryByText("No rate on file — enter an amount.")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Dry Run · 40 Yard · J-2")).toBeInTheDocument();
  });

  it("warns before saving a job that no line item bills", async () => {
    await openStatementWithBothJobs();
    const user = userEvent.setup();
    // Price the second job, then delete its line — the job stays attached.
    const amounts = screen.getAllByLabelText(/amount/i) as HTMLInputElement[];
    await user.type(amounts[1], "175.00");
    const removes = screen.getAllByRole("button", { name: /Remove/i });
    await user.click(removes[1]);

    confirmAnswer = false;
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0].message).toMatch(/J-2/);
    expect(saved).toHaveLength(0);

    confirmAnswer = true;
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved).toHaveLength(1);
  });

  it("shows no asterisk on the invoicing fields but keeps them required", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    // Austin asked for no asterisks in invoicing; the contract is still required.
    expect(screen.getByLabelText(/Customer/i)).toHaveAttribute("aria-required", "true");
    for (const text of ["Customer", "Completed job"]) {
      expect(screen.getByText(text, { selector: "label" }).textContent).not.toContain("*");
    }
  });

  it("bills a new one-off name from the invoice itself, with no customer profile step", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Maria Lopez");
    await user.tab();

    // No detour through the customer form: the invoice collects what it needs.
    expect(confirmCalls).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: /Add Customer/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Maria Lopez will be added as a One-off customer/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Billing name/i)).toHaveValue("Maria Lopez");

    await user.type(screen.getByLabelText(/Billing email/i), "maria@example.com");
    await user.type(screen.getByLabelText(/Street address/i), "42 Desert Rd");
    await user.type(screen.getByLabelText(/^City/i), "Henderson");
    await user.type(screen.getByLabelText(/^State/i), "nv");
    await user.type(screen.getByLabelText(/^ZIP/i), "89002");
    await user.selectOptions(screen.getByLabelText(/Billing mode/i), "one_off");
    await user.type(screen.getByLabelText(/Line 1 description/i), "10 yard cleanup");
    await user.type(screen.getByLabelText(/Line 1 amount/i), "350");
    await user.click(screen.getByRole("button", { name: /Save draft/i }));

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      customerId: "",
      customerName: "Maria Lopez",
      saveBillingToCustomer: false,
      billing: { contactName: "Maria Lopez", email: "maria@example.com", addressLine1: "42 Desert Rd", city: "Henderson", state: "NV", postalCode: "89002" },
    });
  });

  it("prefills an existing customer's billing details and offers to fill the profile's gaps", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Vegas GC");

    expect(screen.getByLabelText(/Billing name/i)).toHaveValue("Pat");
    expect(screen.getByLabelText(/Billing email/i)).toHaveValue("pat@x.com");
    // The profile has no billing address, so saving back is offered and on.
    expect(screen.getByLabelText(/Also save these details to Vegas GC/i)).toBeChecked();

    // Changing the email here applies to this invoice.
    await user.clear(screen.getByLabelText(/Billing email/i));
    await user.type(screen.getByLabelText(/Billing email/i), "ap@vegasgc.com");
    await user.click(screen.getByRole("radio", { name: /J-1/i }));
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved[0]).toMatchObject({ customerId: "cust-1", saveBillingToCustomer: true, billing: { email: "ap@vegasgc.com" } });
    expect(saved[0]).not.toHaveProperty("customerName");
  });

  it("fills the billing address from the selected job's site in one click", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Vegas GC");
    await user.click(screen.getByRole("radio", { name: /J-1/i }));
    await user.click(screen.getByRole("button", { name: /Use job site address/i }));
    expect(screen.getByLabelText(/Street address/i)).toHaveValue("500 Fremont St");
    expect(screen.getByLabelText(/^City/i)).toHaveValue("Las Vegas");
    expect(screen.getByLabelText(/^State/i)).toHaveValue("NV");
    expect(screen.getByLabelText(/^ZIP/i)).toHaveValue("89101");
  });

  it("refuses a malformed billing email before saving", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Maria Lopez");
    await user.type(screen.getByLabelText(/Billing email/i), "maria-at-example");
    await user.selectOptions(screen.getByLabelText(/Billing mode/i), "one_off");
    await user.type(screen.getByLabelText(/Line 1 description/i), "Cleanup");
    await user.type(screen.getByLabelText(/Line 1 amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved).toHaveLength(0);
  });
});

// Austin, 2026-10-07: a GC is quoted an all-in $525 for a 40-yard and is
// invoiced exactly that plus the fuel fee he chooses; sales tax is a button he
// clicks only for the customers he wants to charge it, like the fuel fee.
describe("InvoiceModal — sales tax is a per-invoice choice", () => {
  const rental = { id: "p40", serviceType: "Delivery", dumpsterSize: "40 Yard", priceCents: 52500 };
  const taxSettings = { taxPolicyStatus: "fixed_rate_approved", salesTaxRate: 8.375 };

  afterEach(() => {
    cleanup();
    saved.length = 0;
    priceList.splice(priceList.indexOf(rental), 1);
    for (const key of Object.keys(taxSettings)) delete settings[key];
  });

  const startOneOff = async (name: string) => {
    priceList.push(rental);
    Object.assign(settings, taxSettings);
    const view = render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), name);
    await user.selectOptions(screen.getByLabelText(/Billing mode/i), "one_off");
    await user.selectOptions(screen.getByLabelText(/Add priced catalog line/i), "p40");
    return { user, view };
  };

  it("bills a GC's all-in price plus the fuel fee, with no tax added", async () => {
    const { user } = await startOneOff("Vegas GC");
    await user.click(screen.getByRole("button", { name: "Add 5% fuel fee" }));

    expect(screen.getByText("Not charged · Total $551.25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 8.375% sales tax" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved[0]).toMatchObject({
      chargeSalesTax: false,
      items: [
        { description: "40 Yard Delivery", amountCents: 52500 },
        { description: "Fuel & Environmental Recovery Fee (5% of $525.00)", amountCents: 2625 },
      ],
    });
  });

  it("adds 8.375% only when the office clicks the button, and takes it off again", async () => {
    const { user } = await startOneOff("Maria Lopez");
    await user.click(screen.getByRole("button", { name: "Add 8.375% sales tax" }));
    // $525 × 8.375% = $43.97 (43.96875, rounded per line as Stripe does).
    expect(screen.getByText("8.375% · $43.97 · Total $568.97")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove sales tax" }));
    expect(screen.getByText("Not charged · Total $525.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add 8.375% sales tax" }));
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved[0]).toMatchObject({ chargeSalesTax: true });
  });

  it("reopens a saved draft with the choice it was saved with", async () => {
    Object.assign(settings, taxSettings);
    const draft = {
      id: "inv-1", customerId: "cust-1", status: "draft", billingMode: "one_off", jobIds: [], paymentTerms: "net_30",
      poNumber: "", notes: "", chargeSalesTax: true, revisedFromId: null,
      billingContactName: "", billingEmail: "", billingAddressLine1: "", billingAddressLine2: "", billingCity: "", billingState: "", billingPostalCode: "",
      lineItems: [{ id: "l1", description: "10 yard cleanup", amountCents: 40000, jobId: null, category: "service" }],
    } as unknown as InvoiceRecord;
    render(<InvoiceModal open onClose={() => {}} invoice={draft} />);
    expect(screen.getByRole("button", { name: "Remove sales tax" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("8.375% · $33.50 · Total $433.50")).toBeInTheDocument();
  });
});

// Austin, 2026-10-08: John Evans needed a one-week rental extension. He has no
// uninvoiced completed job, the modal defaulted to "Per job", and Save draft
// answered with a message that never said to switch to a one-off invoice.
describe("InvoiceModal — an extension for a customer with no job to bill", () => {
  afterEach(() => {
    cleanup();
    saved.length = 0;
    toasts.length = 0;
  });

  const startExtension = async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "John Evans");
    await user.click(screen.getByRole("button", { name: "Add extended rental" }));
    return user;
  };

  it("adds an extended rental line with the amount left for the office to enter", async () => {
    await startExtension();
    expect(screen.getByLabelText(/Line 1 description/i)).toHaveValue("Extended Rental - 1 week");
    expect(screen.getByLabelText(/Line 1 category/i)).toHaveValue("rental");
    expect(screen.getByLabelText(/Line 1 amount/i)).toHaveValue(null);
    expect(screen.getByText(/No rate on file — enter an amount/)).toBeInTheDocument();
  });

  it("says what to do instead of asking for completed work that does not exist", async () => {
    const user = await startExtension();
    await user.type(screen.getByLabelText(/Line 1 amount/i), "100");
    await user.click(screen.getByRole("button", { name: /Save draft/i }));

    expect(saved).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/switch Billing mode to "One-off \(no job\)"/);
  });

  it("switches to a one-off invoice in one click and saves it with the PO number", async () => {
    const user = await startExtension();
    await user.type(screen.getByLabelText(/Line 1 amount/i), "100");
    await user.type(screen.getByLabelText(/PO number/i), "PO-7731");
    await user.click(screen.getByRole("button", { name: /Bill without a job/i }));
    expect(screen.getByLabelText(/Billing mode/i)).toHaveValue("one_off");

    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    expect(saved[0]).toMatchObject({
      customerId: "cust-2",
      billingMode: "one_off",
      jobIds: [],
      poNumber: "PO-7731",
      items: [{ description: "Extended Rental - 1 week", amountCents: 10000, category: "rental", jobId: null }],
    });
  });
});
