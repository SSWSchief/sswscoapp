import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvoiceModal } from "./InvoiceModal";
import type { Customer, Job } from "@/lib/types";

const customers = [
  { id: "cust-1", name: "Vegas GC", billingContactName: "Pat", billingEmail: "pat@x.com" },
] as Customer[];

const jobs = [
  { id: "job-1", customerId: "cust-1", status: "complete", serviceType: "Delivery", dumpsterSize: "20 Yard", reference: "J-1" },
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

const settings = { defaultPaymentTerms: "net_30" };
// Only Delivery · 20 Yard is priced — Dry Run has no rate on file, mirroring
// production where several service types are seeded for one size only.
const priceList = [{ id: "p1", serviceType: "Delivery", dumpsterSize: "20 Yard", priceCents: 40000 }];
const invoices: unknown[] = [];
const expandedOperationsValue = {
  saveInvoice: async (payload: unknown) => { saved.push(payload); return { ok: true, data: {} }; },
  settings, priceList, invoices,
};
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: () => expandedOperationsValue,
}));
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => ({ toast: () => {} }) }));

global.fetch = vi.fn(() => Promise.reject(new Error("no network in test"))) as unknown as typeof fetch;

describe("InvoiceModal — multi-job statement", () => {
  afterEach(() => {
    cleanup();
    saved.length = 0;
    savedCustomers.length = 0;
    confirmCalls.length = 0;
    confirmAnswer = true;
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

    expect(screen.queryByText(/No rate on file/i)).not.toBeInTheDocument();
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

  it("offers to create a customer whose name matches nothing, and prefills it", async () => {
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText(/Customer/i);
    await user.type(field, "Henderson Framing");
    await user.tab();

    // The unmatched name is read as an intent to create, not as a typo.
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0].title).toMatch(/Henderson Framing/);

    // The full billing form takes over, carrying the typed name — invoicing
    // needs the billing contact and address it collects.
    expect(await screen.findByRole("dialog", { name: /Add Customer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/i)).toHaveValue("Henderson Framing");
    expect(screen.getByLabelText(/Billing contact name/i)).toHaveValue("Henderson Framing");
  });

  it("leaves the name alone when the create offer is declined", async () => {
    confirmAnswer = false;
    render(<InvoiceModal open onClose={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Customer/i), "Henderson Framing");
    await user.tab();

    expect(screen.queryByRole("dialog", { name: /Add Customer/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Customer/i)).toHaveValue("Henderson Framing");
  });
});
