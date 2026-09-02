import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { ensureStripeCustomer, pushInvoiceToStripe } from "./invoice-push";

interface Call {
  params: Record<string, unknown>;
  options?: { idempotencyKey?: string };
}

const fakeStripe = () => {
  const calls: Record<string, Call[]> = {
    createInvoice: [],
    createItem: [],
    finalize: [],
    send: [],
    createCustomer: [],
  };
  const stripe = {
    customers: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => {
        calls.createCustomer.push({ params, options });
        return { id: "cus_new" };
      },
    },
    invoices: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => {
        calls.createInvoice.push({ params, options });
        return { id: "in_1" };
      },
      finalizeInvoice: async (id: string, _p: unknown, options?: Call["options"]) => {
        calls.finalize.push({ params: { id }, options });
        return { hosted_invoice_url: "https://pay/x", invoice_pdf: "https://pay/x.pdf", status: "open" };
      },
      sendInvoice: async (id: string, _p: unknown, options?: Call["options"]) => {
        calls.send.push({ params: { id }, options });
        return { hosted_invoice_url: "https://pay/x", invoice_pdf: "https://pay/x.pdf", status: "open" };
      },
    },
    invoiceItems: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => {
        calls.createItem.push({ params, options });
        return { id: "ii_1" };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
};

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-1",
  invoiceNumber: "INV-1042",
  amountCents: 40000,
  dueDate: "2099-01-01",
  notes: "20 yard roll-off",
  poNumber: "PO-88231",
  jobReference: "#1052",
  terms: "PROHIBITED MATERIALS: paint, tires, batteries.",
  ...overrides,
});

describe("pushInvoiceToStripe", () => {
  it("prints the rental terms on the invoice", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice(), "cus_1");
    expect(calls.createInvoice[0].params.footer).toBe(
      "PROHIBITED MATERIALS: paint, tires, batteries.",
    );
  });

  it("omits the footer entirely when no terms are set", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice({ terms: "" }), "cus_1");
    expect(calls.createInvoice[0].params.footer).toBeUndefined();
  });

  it("points the payer at the terms, since Stripe hides the footer on the page", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice(), "cus_1");
    expect(calls.createInvoice[0].params.description).toBe(
      "20 yard roll-off — Rental terms and prohibited materials are on the invoice PDF.",
    );
  });

  it("leaves the memo alone when there are no terms to point at", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice({ terms: "" }), "cus_1");
    expect(calls.createInvoice[0].params.description).toBe("20 yard roll-off");
  });

  it("uses the office's own invoice number, not Stripe's", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice(), "cus_1");
    expect(calls.createInvoice[0].params.number).toBe("INV-1042");
  });

  it("puts the PO and job on the face of the invoice", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice(), "cus_1");
    const fields = calls.createInvoice[0].params.custom_fields as {
      name: string;
      value: string;
    }[];
    expect(fields).toEqual([
      { name: "PO Number", value: "PO-88231" },
      { name: "Job", value: "#1052" },
    ]);
  });

  it("keys every call on our invoice id so a retry cannot bill twice", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice(), "cus_1");
    expect(calls.createInvoice[0].options?.idempotencyKey).toBe("invoice:inv-1:create");
    expect(calls.createItem[0].options?.idempotencyKey).toBe("invoice:inv-1:item");
    expect(calls.finalize[0].options?.idempotencyKey).toBe("invoice:inv-1:finalize");
    expect(calls.send[0].options?.idempotencyKey).toBe("invoice:inv-1:send");
  });

  it("does not send Stripe a due date in the past", async () => {
    const { stripe, calls } = fakeStripe();
    await pushInvoiceToStripe(stripe, invoice({ dueDate: "2020-01-01" }), "cus_1");
    const due = calls.createInvoice[0].params.due_date as number;
    // Invoicing late is not an error; Stripe just refuses a past due date, so
    // it becomes due immediately rather than failing the send.
    expect(due).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("ensureStripeCustomer", () => {
  it("reuses the Stripe customer a record already has", async () => {
    const { stripe, calls } = fakeStripe();
    const id = await ensureStripeCustomer(stripe, {
      id: "c1", name: "Vegas GC", email: "", phone: "", address: "",
      stripeCustomerId: "cus_existing",
    });
    expect(id).toBe("cus_existing");
    expect(calls.createCustomer).toHaveLength(0);
  });

  it("keys creation on our customer id so a retry cannot duplicate them", async () => {
    const { stripe, calls } = fakeStripe();
    await ensureStripeCustomer(stripe, {
      id: "c1", name: "Vegas GC", email: "ap@example.com", phone: "", address: "",
      stripeCustomerId: null,
    });
    expect(calls.createCustomer[0].options?.idempotencyKey).toBe("customer:c1");
  });
});
