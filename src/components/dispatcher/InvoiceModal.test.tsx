import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceModal } from "./InvoiceModal";
import type { Customer, Dumpster, InvoiceDraftInput, PriceListItem } from "@/lib/types";

const state = {
  saved: [] as InvoiceDraftInput[],
  toasts: [] as string[],
};

const customers = [
  {
    id: "cust-1",
    name: "Vegas GC",
    billingContactName: "AP",
    billingEmail: "ap@vegasgc.invalid",
    billingAddressLine1: "1 A St",
    billingCity: "Las Vegas",
    billingState: "NV",
    billingPostalCode: "89101",
  },
] as Customer[];

const priceList = [
  { id: "rate-1", serviceType: "Delivery", dumpsterSize: "20 Yard", priceCents: 40000, notes: "", updatedAt: "" },
] as PriceListItem[];

const dumpsters = [
  { id: "d-1", code: "D-102", size: "20 Yard", status: "in_yard", type: "Roll-off", currentCustomerId: null, currentLocation: "", currentJobId: null, airTagId: null, notes: "" },
] as Dumpster[];

// Both hook results are frozen module constants rather than fresh object
// literals: the editor keys an effect on `settings`, so a new object per render
// would re-seed the form forever.
const operations = { customers, jobs: [], dumpsters, canMutate: true };
const expanded = {
  invoices: [],
  priceList,
  settings: { defaultPaymentTerms: "net_30" },
  saveInvoice: async (input: InvoiceDraftInput) => {
    state.saved.push(input);
    return { ok: true, data: undefined };
  },
};
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => operations,
}));
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: () => expanded,
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: (message: string) => state.toasts.push(message) }),
}));

const line = (index: number) => ({
  description: screen.getByLabelText(`Line ${index} description`),
  amount: screen.getByLabelText(`Line ${index} amount`),
  category: screen.getByLabelText(`Line ${index} category`),
});

const openOneOff = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.selectOptions(screen.getByLabelText(/customer/i), "cust-1");
  await user.selectOptions(screen.getByLabelText(/billing mode/i), "one_off");
};

describe("InvoiceModal", () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.saved = [];
    state.toasts = [];
    // jsdom has no fetch for the eligible-jobs lookup; the local job list
    // stands in, and these tests are about line items rather than job pickers.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  });

  describe("line item descriptions", () => {
    it("offers the rate card and the fleet as pickable descriptions", () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const options = Array.from(
        document.querySelectorAll<HTMLOptionElement>("#invoice-line-descriptions option"),
      ).map((option) => option.value);
      expect(options).toContain("Delivery · 20 Yard");
      // The container the office would name on the line, straight from the
      // dumpster records rather than a second list kept by hand.
      expect(options).toContain("Delivery · 20 Yard · D-102");
      expect(options).toContain("Fuel surcharge");
    });

    it("fills the rate when a priced description is picked", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(line(1).description, "Delivery · 20 Yard · D-102");
      await waitFor(() => expect(line(1).amount).toHaveValue(400));
    });

    it("never overwrites an amount somebody typed", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(line(1).amount, "375");
      await user.type(line(1).description, "Delivery · 20 Yard");
      expect(line(1).amount).toHaveValue(375);
    });

    it("names the surcharge SSWSCO actually bills", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      expect(
        within(line(1).category as HTMLSelectElement).getByRole("option", { name: "Fuel surcharge" }),
      ).toBeInTheDocument();
      await user.selectOptions(line(1).category, "surcharge");
      expect(line(1).description).toHaveValue("Fuel surcharge");
    });
  });

  describe("charges the customer has to be able to read", () => {
    it("refuses a fee that says nothing but 'fee'", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await openOneOff(user);
      await user.type(line(1).description, "Fee");
      await user.type(line(1).amount, "250");
      await user.selectOptions(line(1).category, "fee");
      await user.click(screen.getByRole("button", { name: /save draft/i }));

      expect(state.saved).toHaveLength(0);
      expect(state.toasts.join(" ")).toMatch(/so the customer knows what it is for/i);
    });

    it("accepts a fee that says what it is for", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await openOneOff(user);
      await user.selectOptions(line(1).category, "fee");
      await user.type(line(1).description, "Prohibited material in the container");
      await user.type(line(1).amount, "250");
      await user.click(screen.getByRole("button", { name: /save draft/i }));

      await waitFor(() => expect(state.saved).toHaveLength(1));
      expect(state.saved[0].items[0]).toMatchObject({
        description: "Prohibited material in the container",
        amountCents: 25000,
        category: "fee",
      });
    });
  });

  describe("charges with no job behind them", () => {
    it("bills an extended rental with no completed job", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await openOneOff(user);
      await user.selectOptions(line(1).category, "rental");
      await user.type(line(1).description, "Extended rental — 4 additional days");
      await user.type(line(1).amount, "100");
      await user.click(screen.getByRole("button", { name: /save draft/i }));

      await waitFor(() => expect(state.saved).toHaveLength(1));
      expect(state.saved[0]).toMatchObject({ billingMode: "one_off", jobIds: [] });
    });

    it("still refuses a per-job invoice with nothing selected", async () => {
      render(<InvoiceModal open onClose={() => {}} />);
      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText(/customer/i), "cust-1");
      await user.type(line(1).description, "Unbacked charge");
      await user.type(line(1).amount, "100");
      await user.click(screen.getByRole("button", { name: /save draft/i }));

      expect(state.saved).toHaveLength(0);
      expect(state.toasts.join(" ")).toMatch(/Select completed work/i);
    });
  });
});
