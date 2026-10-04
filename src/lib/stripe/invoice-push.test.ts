import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { applyStripeInvoiceTax, createStripeInvoiceDraft, ensureSalesTaxRate, findStripeInvoiceByLocalMetadata, replaceStripeInvoiceItems, syncStripeCustomer } from "./invoice-push";

interface Call { params: Record<string, unknown>; options?: { idempotencyKey?: string } }
/**
 * Existing Stripe lines, as the SDK hands them over: an auto-paginating
 * iterable rather than one page. `existingLines` stands in for every page.
 */
const fakeStripe = (existingLines: Array<{ invoice_item: string }> = []) => {
  const calls: Record<string, Call[]> = { createInvoice: [], updateInvoice: [], createItem: [], createCustomer: [], updateCustomer: [], searchInvoice: [], createTaxRate: [] };
  const taxRates: Record<string, { id: string; active: boolean; inclusive: boolean; percentage: number }> = {
    txr_old: { id: "txr_old", active: true, inclusive: false, percentage: 8.25 },
    txr_current: { id: "txr_current", active: true, inclusive: false, percentage: 8.375 },
    txr_archived: { id: "txr_archived", active: false, inclusive: false, percentage: 8.375 },
  };
  const deletedItems: string[] = [];
  const stripe = {
    customers: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createCustomer.push({ params, options }); return { id: "cus_new" }; },
      update: async (id: string, params: Record<string, unknown>) => { calls.updateCustomer.push({ params: { id, ...params } }); return { id }; },
    },
    invoices: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createInvoice.push({ params, options }); return { id: "in_1" }; },
      update: async (id: string, params: Record<string, unknown>, options?: Call["options"]) => { calls.updateInvoice.push({ params: { id, ...params }, options }); return { id }; },
      search: async (params: Record<string, unknown>) => { calls.searchInvoice.push({ params }); return { data: [] }; },
      listLineItems: () => ({
        async *[Symbol.asyncIterator]() {
          for (const item of existingLines)
            yield { parent: { invoice_item_details: { invoice_item: item.invoice_item } } };
        },
      }),
    },
    taxRates: {
      retrieve: async (id: string) => { if (!taxRates[id]) throw new Error("No such tax rate"); return taxRates[id]; },
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createTaxRate.push({ params, options }); return { id: "txr_new" }; },
    },
    invoiceItems: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createItem.push({ params, options }); return { id: "ii_1" }; },
      del: async (id: string) => { deletedItems.push(id); return { deleted: true }; },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls, deletedItems };
};
const invoice = (terms = "Rental terms") => ({
  id: "inv-1", invoiceNumber: "INV-000001", paymentTerms: "net_30" as const,
  notes: "Office reviewed", poNumber: "PO-1", terms,
  lineItems: [{ id: "line-1", description: "20 yard delivery", amountCents: 40000, jobId: "job-1", category: "service" as const }],
});

describe("Stripe invoice drafts", () => {
  it("pins card and ACH, terms, number, metadata, and idempotency", async () => {
    const { stripe, calls } = fakeStripe();
    await createStripeInvoiceDraft(stripe, invoice(), "cus_1", null, ["txr_current"]);
    expect(calls.createInvoice[0].params).toMatchObject({
      number: "INV-000001", footer: "Rental terms", days_until_due: 30,
      automatic_tax: { enabled: false },
      default_tax_rates: ["txr_current"],
      payment_settings: { payment_method_types: ["card", "us_bank_account"] },
      metadata: { sswsco_invoice_id: "inv-1", sswsco_invoice_number: "INV-000001" },
    });
    expect(calls.createInvoice[0].options?.idempotencyKey).toBe("invoice:inv-1:create");
  });
  it("writes durable line items with stable keys", async () => {
    const { stripe, calls } = fakeStripe();
    await replaceStripeInvoiceItems(stripe, invoice(), "cus_1", "in_1");
    expect(calls.createItem[0].params).toMatchObject({ amount: 40000, invoice: "in_1", description: "20 yard delivery" });
    // Nevada taxes the rental, so no line may carry Stripe's "services" code,
    // which is what made automatic tax charge 0%.
    expect(calls.createItem[0].params).not.toHaveProperty("tax_code");
    expect(calls.createItem[0].options?.idempotencyKey).toBe("invoice:inv-1:item:line-1");
  });
  /**
   * A revision is cloned from its original with every line attached, so the
   * lines to clear can run past a single page. One survivor here would be a
   * second charge on the customer's invoice.
   */
  it("clears every cloned line, not just the first page", async () => {
    const existing = Array.from({ length: 150 }, (_, index) => ({ invoice_item: `ii_old_${index}` }));
    const { stripe, deletedItems } = fakeStripe(existing);
    await replaceStripeInvoiceItems(stripe, invoice(), "cus_1", "in_1");
    expect(deletedItems).toHaveLength(150);
    expect(deletedItems.at(-1)).toBe("ii_old_149");
  });
  it("recovers a uniquely matching remote invoice from trusted metadata", async () => {
    const { stripe } = fakeStripe();
    vi.spyOn(stripe.invoices, "search").mockResolvedValue({ data: [{ id: "in_recovered", currency: "usd", status: "draft", metadata: { sswsco_invoice_id: "inv-1", sswsco_invoice_number: "INV-000001" } }] } as unknown as Awaited<ReturnType<typeof stripe.invoices.search>>);
    expect((await findStripeInvoiceByLocalMetadata(stripe, invoice()))?.id).toBe("in_recovered");
  });
});

describe("Nevada sales tax rate", () => {
  it("reuses the saved rate while it still carries the same percentage", async () => {
    const { stripe, calls } = fakeStripe();
    expect(await ensureSalesTaxRate(stripe, 8.375, "txr_current")).toBe("txr_current");
    expect(calls.createTaxRate).toHaveLength(0);
  });
  it("creates an exclusive Nevada rate when none is saved, or the saved one changed or was archived", async () => {
    for (const existing of [null, "txr_old", "txr_archived", "txr_missing"]) {
      const { stripe, calls } = fakeStripe();
      expect(await ensureSalesTaxRate(stripe, 8.375, existing)).toBe("txr_new");
      expect(calls.createTaxRate[0].params).toMatchObject({ percentage: 8.375, inclusive: false, country: "US", state: "NV", tax_type: "sales_tax" });
      expect(calls.createTaxRate[0].options?.idempotencyKey).toBe("sales-tax-rate:NV:8.375");
    }
  });
  it("moves a draft off automatic tax and onto the fixed rate, or clears it", async () => {
    const { stripe, calls } = fakeStripe();
    await applyStripeInvoiceTax(stripe, "inv-1", "in_1", ["txr_current"]);
    expect(calls.updateInvoice[0].params).toEqual({ id: "in_1", automatic_tax: { enabled: false }, default_tax_rates: ["txr_current"] });
    await applyStripeInvoiceTax(stripe, "inv-1", "in_1", []);
    expect(calls.updateInvoice[1].params).toMatchObject({ default_tax_rates: "" });
  });
  it("leaves the rate list off a draft that carries no tax", async () => {
    const { stripe, calls } = fakeStripe();
    await createStripeInvoiceDraft(stripe, invoice(), "cus_1", null, []);
    expect(calls.createInvoice[0].params).not.toHaveProperty("default_tax_rates");
  });
});

describe("Stripe customer synchronization", () => {
  const customer = { id: "c1", name: "Accounts Payable", email: "ap@example.com", phone: "", address: { line1: "1 Main", line2: "", city: "Reno", state: "NV", postalCode: "89501", country: "US" as const }, stripeCustomerId: null };
  it("creates once with a stable key", async () => {
    const { stripe, calls } = fakeStripe();
    expect(await syncStripeCustomer(stripe, customer)).toBe("cus_new");
    expect(calls.createCustomer[0].options?.idempotencyKey).toBe("customer:c1");
  });
  it("refreshes an existing customer from the reviewed snapshot", async () => {
    const { stripe, calls } = fakeStripe();
    expect(await syncStripeCustomer(stripe, { ...customer, stripeCustomerId: "cus_existing" })).toBe("cus_existing");
    expect(calls.updateCustomer[0].params).toMatchObject({ id: "cus_existing", email: "ap@example.com" });
  });
});
