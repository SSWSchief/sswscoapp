import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createStripeInvoiceDraft, findStripeInvoiceByLocalMetadata, replaceStripeInvoiceItems, syncStripeCustomer } from "./invoice-push";

interface Call { params: Record<string, unknown>; options?: { idempotencyKey?: string } }
/**
 * Existing Stripe lines, as the SDK hands them over: an auto-paginating
 * iterable rather than one page. `existingLines` stands in for every page.
 */
const fakeStripe = (existingLines: Array<{ invoice_item: string }> = []) => {
  const calls: Record<string, Call[]> = { createInvoice: [], createItem: [], createCustomer: [], updateCustomer: [], searchInvoice: [] };
  const deletedItems: string[] = [];
  const stripe = {
    customers: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createCustomer.push({ params, options }); return { id: "cus_new" }; },
      update: async (id: string, params: Record<string, unknown>) => { calls.updateCustomer.push({ params: { id, ...params } }); return { id }; },
    },
    invoices: {
      create: async (params: Record<string, unknown>, options?: Call["options"]) => { calls.createInvoice.push({ params, options }); return { id: "in_1" }; },
      search: async (params: Record<string, unknown>) => { calls.searchInvoice.push({ params }); return { data: [] }; },
      listLineItems: () => ({
        async *[Symbol.asyncIterator]() {
          for (const item of existingLines)
            yield { parent: { invoice_item_details: { invoice_item: item.invoice_item } } };
        },
      }),
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
    await createStripeInvoiceDraft(stripe, invoice(), "cus_1");
    expect(calls.createInvoice[0].params).toMatchObject({
      number: "INV-000001", footer: "Rental terms", days_until_due: 30,
      payment_settings: { payment_method_types: ["card", "us_bank_account"] },
      metadata: { sswsco_invoice_id: "inv-1", sswsco_invoice_number: "INV-000001" },
    });
    expect(calls.createInvoice[0].options?.idempotencyKey).toBe("invoice:inv-1:create");
  });
  it("writes durable line items with stable keys", async () => {
    const { stripe, calls } = fakeStripe();
    await replaceStripeInvoiceItems(stripe, invoice(), "cus_1", "in_1");
    expect(calls.createItem[0].params).toMatchObject({ amount: 40000, invoice: "in_1", description: "20 yard delivery" });
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
