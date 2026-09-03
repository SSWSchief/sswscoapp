import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

const stripeRetrieve = vi.fn();
const stripeSendInvoice = vi.fn();
const stripeVoid = vi.fn();
const stripeMarkUncollectible = vi.fn();
const keyMode = vi.fn(() => "test" as "test" | "live");

vi.mock("./client", () => ({
  requireStripeInvoicing: async () => ({
    invoices: {
      retrieve: stripeRetrieve,
      sendInvoice: stripeSendInvoice,
      voidInvoice: stripeVoid,
      markUncollectible: stripeMarkUncollectible,
    },
  }),
  stripeKeyMode: () => keyMode(),
}));

const syncStripeCustomer = vi.fn(async () => "cus_1");
const createStripeInvoiceDraft = vi.fn(async () => ({ id: "in_created" }));
const findStripeInvoiceByLocalMetadata = vi.fn(async () => null);
const replaceStripeInvoiceItems = vi.fn(async () => undefined);
const finalizeAndSendStripeInvoice = vi.fn(async () => ({
  invoice: { id: "in_created", status: "open" } as unknown as Stripe.Invoice,
}));
const resendStripeInvoice = vi.fn(async () => ({ id: "in_1", status: "open" } as unknown as Stripe.Invoice));

vi.mock("./invoice-push", () => ({
  syncStripeCustomer: (...a: unknown[]) => syncStripeCustomer(...(a as [])),
  createStripeInvoiceDraft: (...a: unknown[]) => createStripeInvoiceDraft(...(a as [])),
  findStripeInvoiceByLocalMetadata: (...a: unknown[]) => findStripeInvoiceByLocalMetadata(...(a as [])),
  replaceStripeInvoiceItems: (...a: unknown[]) => replaceStripeInvoiceItems(...(a as [])),
  finalizeAndSendStripeInvoice: (...a: unknown[]) => finalizeAndSendStripeInvoice(...(a as [])),
  resendStripeInvoice: (...a: unknown[]) => resendStripeInvoice(...(a as [])),
}));

const applySnapshot = vi.fn(async (_db: unknown, remote: Stripe.Invoice) => ({ id: "inv-1", status: remote.status }));
vi.mock("./reconcile", () => ({
  applyStripeInvoiceSnapshot: (...a: unknown[]) => applySnapshot(...(a as [unknown, Stripe.Invoice])),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("tests pass their own client"); } }));

const { sendInvoice, resendInvoice, transitionInvoice } = await import("./invoice-lifecycle");

/** A draft that is complete enough to send; overrides break one rule at a time. */
const invoiceRow = (overrides: Row = {}): Row => ({
  id: "inv-1",
  invoice_number: "QA-000001",
  customer_id: "cust-1",
  status: "draft",
  amount_cents: 40000,
  payment_terms: "net_30",
  notes: "",
  po_number: "",
  billing_contact_name: "Legacy AP",
  billing_email: "ap@legacy.invalid",
  billing_address_line1: "9 Old Road",
  billing_address_line2: "",
  billing_city: "Reno",
  billing_state: "NV",
  billing_postal_code: "89501",
  billing_country: "US",
  stripe_invoice_id: null,
  stripe_customer_id_snapshot: null,
  stripe_sync_state: "not_started",
  stripe_sync_error: null,
  revised_from_id: null,
  ...overrides,
});

const world = (overrides: { invoice?: Row; settings?: Row; job?: Row; lines?: Row[] } = {}) => {
  const fake = fakeAdminClient({
    invoices: [invoiceRow(overrides.invoice)],
    invoice_line_items: overrides.lines ?? [
      { id: "line-1", invoice_id: "inv-1", description: "20 yard delivery", amount_cents: 40000, position: 0, job_id: "job-1", category: "service" },
    ],
    invoice_jobs: [{ invoice_id: "inv-1", job_id: "job-1", active: true }],
    jobs: [{ id: "job-1", customer_id: "cust-1", status: "complete", deleted_at: null, ...overrides.job }],
    customers: [{ id: "cust-1", phone: "555-0100", stripe_customer_id: null }],
    company_settings: [{ invoice_terms: "Rental terms apply.", tax_policy_status: "pending", ...overrides.settings }],
  });
  return { fake, client: fake.client as unknown as SupabaseClient<Database> };
};

beforeEach(() => {
  vi.clearAllMocks();
  keyMode.mockReturnValue("test");
  createStripeInvoiceDraft.mockResolvedValue({ id: "in_created" });
  findStripeInvoiceByLocalMetadata.mockResolvedValue(null);
  finalizeAndSendStripeInvoice.mockResolvedValue({ invoice: { id: "in_created", status: "open" } as unknown as Stripe.Invoice });
  stripeRetrieve.mockResolvedValue({ id: "in_created", status: "draft" });
  applySnapshot.mockImplementation(async (_db: unknown, remote: Stripe.Invoice) => ({ id: "inv-1", status: remote.status }));
});

describe("sendInvoice", () => {
  it("pushes the draft to Stripe and records the link before finalizing", async () => {
    const { fake, client } = world();
    await sendInvoice("inv-1", client);
    expect(syncStripeCustomer).toHaveBeenCalledOnce();
    expect(createStripeInvoiceDraft).toHaveBeenCalledOnce();
    expect(replaceStripeInvoiceItems).toHaveBeenCalledOnce();
    expect(finalizeAndSendStripeInvoice).toHaveBeenCalledOnce();
    const stored = fake.tables.invoices[0];
    expect(stored.stripe_invoice_id).toBe("in_created");
    expect(stored.stripe_customer_id_snapshot).toBe("cus_1");
  });

  it("saves the Stripe customer back onto the customer record", async () => {
    const { fake, client } = world();
    await sendInvoice("inv-1", client);
    expect(fake.tables.customers[0].stripe_customer_id).toBe("cus_1");
  });

  it("recovers a remote draft rather than creating a second one", async () => {
    findStripeInvoiceByLocalMetadata.mockResolvedValue({ id: "in_orphan" } as never);
    const { fake, client } = world();
    await sendInvoice("inv-1", client);
    expect(createStripeInvoiceDraft).not.toHaveBeenCalled();
    expect(fake.tables.invoices[0].stripe_invoice_id).toBe("in_orphan");
  });

  it("resumes a half-sent invoice without finalizing an already-open one twice", async () => {
    stripeRetrieve.mockResolvedValue({ id: "in_1", status: "open" });
    stripeSendInvoice.mockResolvedValue({ id: "in_1", status: "open" });
    const { client } = world({ invoice: { stripe_invoice_id: "in_1" } });
    await sendInvoice("inv-1", client);
    expect(finalizeAndSendStripeInvoice).not.toHaveBeenCalled();
    expect(replaceStripeInvoiceItems).not.toHaveBeenCalled();
    expect(stripeSendInvoice).toHaveBeenCalledOnce();
  });

  it("re-reads an invoice that already left draft instead of billing it again", async () => {
    stripeRetrieve.mockResolvedValue({ id: "in_1", status: "paid" });
    const { client } = world({ invoice: { status: "open", stripe_invoice_id: "in_1" } });
    const result = await sendInvoice("inv-1", client);
    expect(createStripeInvoiceDraft).not.toHaveBeenCalled();
    expect(finalizeAndSendStripeInvoice).not.toHaveBeenCalled();
    expect(result?.status).toBe("paid");
  });

  it("records a sync failure without leaking the underlying Stripe error", async () => {
    finalizeAndSendStripeInvoice.mockRejectedValue(new Error("card_declined: acct_secret"));
    const { fake, client } = world();
    await expect(sendInvoice("inv-1", client)).rejects.toThrow(/card_declined/);
    const stored = fake.tables.invoices[0];
    expect(stored.stripe_sync_state).toBe("failed");
    expect(String(stored.stripe_sync_error)).not.toMatch(/acct_secret/);
  });

  describe("refuses to send", () => {
    const cases: Array<[string, Parameters<typeof world>[0], RegExp]> = [
      ["an invoice that is not a draft", { invoice: { status: "open", stripe_invoice_id: null } }, /Only a draft can be sent/],
      ["a draft with no line items", { lines: [] }, /at least one positive line item/i],
      ["a draft whose lines disagree with its total", { invoice: { amount_cents: 999 } }, /line total is out of sync/],
      ["a job that is no longer complete", { job: { status: "pending" } }, /must still be complete/],
      ["a job belonging to another customer", { job: { customer_id: "cust-2" } }, /must still be complete/],
      ["a missing billing contact", { invoice: { billing_contact_name: "  " } }, /billing contact name and email/],
      ["an unusable billing email", { invoice: { billing_email: "not-an-email" } }, /billing contact name and email/],
      ["an incomplete billing address", { invoice: { billing_city: "" } }, /complete US billing address/],
      ["a company with no invoice terms", { settings: { invoice_terms: "" } }, /invoice terms are required/],
    ];
    it.each(cases)("%s", async (_label, overrides, expected) => {
      const { client } = world(overrides);
      await expect(sendInvoice("inv-1", client)).rejects.toThrow(expected);
      expect(createStripeInvoiceDraft).not.toHaveBeenCalled();
    });
  });

  it("blocks live sending until the tax policy is approved, and allows it once it is", async () => {
    keyMode.mockReturnValue("live");
    const pending = world({ settings: { tax_policy_status: "pending" } });
    await expect(sendInvoice("inv-1", pending.client)).rejects.toThrow(/tax policy is approved/);

    const approved = world({ settings: { tax_policy_status: "non_taxable_approved" } });
    await expect(sendInvoice("inv-1", approved.client)).resolves.toBeTruthy();
  });

  it("reactivates the revision's job links and reconciles the original it replaces", async () => {
    const fake = fakeAdminClient({
      invoices: [
        invoiceRow({ id: "inv-1", revised_from_id: "inv-original" }),
        invoiceRow({ id: "inv-original", status: "open", stripe_invoice_id: "in_original" }),
      ],
      invoice_line_items: [{ id: "line-1", invoice_id: "inv-1", description: "Corrected haul", amount_cents: 40000, position: 0, job_id: "job-1", category: "service" }],
      invoice_jobs: [{ invoice_id: "inv-1", job_id: "job-1", active: false }],
      jobs: [{ id: "job-1", customer_id: "cust-1", status: "complete", deleted_at: null }],
      customers: [{ id: "cust-1", phone: "555-0100", stripe_customer_id: "cus_1" }],
      company_settings: [{ invoice_terms: "Rental terms apply.", tax_policy_status: "pending" }],
    });
    stripeRetrieve.mockImplementation(async (id: string) => ({ id, status: id === "in_original" ? "void" : "draft" }));

    await sendInvoice("inv-1", fake.client as unknown as SupabaseClient<Database>);
    expect(createStripeInvoiceDraft).toHaveBeenCalledOnce();
    // The original's Stripe id is passed so Stripe links the two as a revision.
    const draftArguments = createStripeInvoiceDraft.mock.calls[0] as unknown as unknown[];
    expect(draftArguments[3]).toBe("in_original");
    expect(fake.tables.invoice_jobs[0].active).toBe(true);
    expect(applySnapshot).toHaveBeenCalledTimes(2);
  });
});

describe("resendInvoice", () => {
  it("resends an open invoice", async () => {
    const { client } = world({ invoice: { status: "open", stripe_invoice_id: "in_1" } });
    await resendInvoice("inv-1", client);
    expect(resendStripeInvoice).toHaveBeenCalledOnce();
  });

  it("refuses anything that is not an open Stripe invoice", async () => {
    const draft = world();
    await expect(resendInvoice("inv-1", draft.client)).rejects.toThrow(/Only an open Stripe invoice/);
    const paid = world({ invoice: { status: "paid", stripe_invoice_id: "in_1" } });
    await expect(resendInvoice("inv-1", paid.client)).rejects.toThrow(/Only an open Stripe invoice/);
    expect(resendStripeInvoice).not.toHaveBeenCalled();
  });
});

describe("transitionInvoice", () => {
  beforeEach(() => {
    stripeVoid.mockResolvedValue({ id: "in_1", status: "void" });
    stripeMarkUncollectible.mockResolvedValue({ id: "in_1", status: "uncollectible" });
  });

  it("voids an open invoice and writes off an open one", async () => {
    const open = world({ invoice: { status: "open", stripe_invoice_id: "in_1" } });
    expect((await transitionInvoice("inv-1", "void", open.client))?.status).toBe("void");

    const writable = world({ invoice: { status: "open", stripe_invoice_id: "in_1" } });
    expect((await transitionInvoice("inv-1", "uncollectible", writable.client))?.status).toBe("uncollectible");
  });

  it("still allows voiding a written-off invoice", async () => {
    const { client } = world({ invoice: { status: "uncollectible", stripe_invoice_id: "in_1" } });
    await expect(transitionInvoice("inv-1", "void", client)).resolves.toBeTruthy();
  });

  it("refuses transitions that Stripe would reject", async () => {
    const draft = world();
    await expect(transitionInvoice("inv-1", "void", draft.client)).rejects.toThrow(/cannot make that Stripe transition/);
    const paid = world({ invoice: { status: "paid", stripe_invoice_id: "in_1" } });
    await expect(transitionInvoice("inv-1", "uncollectible", paid.client)).rejects.toThrow(/cannot make that Stripe transition/);
    const uncollectible = world({ invoice: { status: "uncollectible", stripe_invoice_id: "in_1" } });
    await expect(transitionInvoice("inv-1", "uncollectible", uncollectible.client)).rejects.toThrow(/cannot make that Stripe transition/);
    expect(stripeVoid).not.toHaveBeenCalled();
  });
});
