import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

const retrieve = vi.fn();
vi.mock("./client", () => ({
  requireStripeInvoicing: async () => ({ invoices: { retrieve } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));

let adminClient: unknown;
const { applyStripeInvoiceSnapshot, reconcileNonterminalInvoices } = await import("./reconcile");

/** A local invoice in whatever state a test needs; unset fields take ledger defaults. */
function localInvoice(overrides: Row = {}): Row {
  return {
    id: "inv-1",
    invoice_number: "QA-000001",
    customer_id: "cust-1",
    status: "open",
    amount_cents: 40000,
    amount_paid_cents: 0,
    amount_remaining_cents: 40000,
    stripe_invoice_id: "in_1",
    hosted_invoice_url: null,
    invoice_pdf_url: null,
    due_date: "2026-09-30",
    issued_at: null,
    sent_at: null,
    paid_at: null,
    closed_at: null,
    stripe_sync_state: "synced",
    stripe_sync_error: null,
    payment_processing_at: null,
    payment_failed_at: null,
    last_stripe_event_created: null,
    revised_from_id: null,
    latest_revision_id: null,
    ...overrides,
  };
}

/** A Stripe invoice as the API returns it, trimmed to the fields read here. */
function remoteInvoice(overrides: Partial<Stripe.Invoice> = {}) {
  return {
    id: "in_1",
    status: "open",
    currency: "usd",
    amount_due: 40000,
    amount_paid: 0,
    amount_remaining: 40000,
    customer: "cus_1",
    hosted_invoice_url: "https://pay.stripe.test/in_1",
    invoice_pdf: "https://pay.stripe.test/in_1.pdf",
    due_date: 1790000000,
    status_transitions: {},
    metadata: {},
    ...overrides,
  } as unknown as Stripe.Invoice;
}

const db = (tables: Record<string, Row[]>) => {
  const fake = fakeAdminClient(tables);
  return { fake, client: fake.client as unknown as SupabaseClient<Database> };
};

describe("applyStripeInvoiceSnapshot", () => {
  it("writes Stripe's money and links onto the matching local invoice", async () => {
    const { fake, client } = db({ invoices: [localInvoice()] });
    const saved = await applyStripeInvoiceSnapshot(
      client,
      remoteInvoice({ status: "paid", amount_paid: 40000, amount_remaining: 0 }),
    );
    expect(saved?.status).toBe("paid");
    const stored = fake.tables.invoices[0];
    expect(stored.amount_paid_cents).toBe(40000);
    expect(stored.amount_remaining_cents).toBe(0);
    expect(stored.hosted_invoice_url).toBe("https://pay.stripe.test/in_1");
    expect(stored.invoice_pdf_url).toBe("https://pay.stripe.test/in_1.pdf");
    expect(stored.stripe_sync_state).toBe("synced");
    expect(stored.stripe_sync_error).toBeNull();
  });

  it("stamps payment and clears the in-flight payment markers when paid", async () => {
    const { fake, client } = db({
      invoices: [localInvoice({ payment_processing_at: "2026-09-01T00:00:00.000Z" })],
    });
    await applyStripeInvoiceSnapshot(
      client,
      remoteInvoice({
        status: "paid",
        amount_paid: 40000,
        amount_remaining: 0,
        status_transitions: { paid_at: 1790000500 } as Stripe.Invoice.StatusTransitions,
      }),
    );
    const stored = fake.tables.invoices[0];
    expect(stored.paid_at).toBe(new Date(1790000500 * 1000).toISOString());
    expect(stored.payment_processing_at).toBeNull();
    expect(stored.payment_failed_at).toBeNull();
  });

  it("ignores a Stripe invoice this ledger has never heard of", async () => {
    const { fake, client } = db({ invoices: [localInvoice()] });
    const saved = await applyStripeInvoiceSnapshot(client, remoteInvoice({ id: "in_stranger" }));
    expect(saved).toBeNull();
    expect(fake.tables.invoices[0].status).toBe("open");
  });

  it("keeps the highest event watermark when an older event is replayed", async () => {
    const { fake, client } = db({
      invoices: [localInvoice({ last_stripe_event_created: 900 })],
    });
    await applyStripeInvoiceSnapshot(client, remoteInvoice(), 500);
    expect(fake.tables.invoices[0].last_stripe_event_created).toBe(900);
    await applyStripeInvoiceSnapshot(client, remoteInvoice(), 1500);
    expect(fake.tables.invoices[0].last_stripe_event_created).toBe(1500);
  });

  it("marks the original invoice as superseded once its revision leaves draft", async () => {
    const { fake, client } = db({
      invoices: [
        localInvoice({ id: "inv-original", stripe_invoice_id: "in_original", latest_revision_id: null }),
        localInvoice({ id: "inv-revision", stripe_invoice_id: "in_revision", revised_from_id: "inv-original" }),
      ],
    });
    await applyStripeInvoiceSnapshot(client, remoteInvoice({ id: "in_revision", status: "open" }));
    const original = fake.tables.invoices.find((row) => row.id === "inv-original");
    expect(original?.latest_revision_id).toBe("inv-revision");
  });

  describe("recovering an invoice whose Stripe id was never persisted", () => {
    const orphan = () => localInvoice({ status: "draft", stripe_invoice_id: null });
    const withMetadata = (overrides: Partial<Stripe.Invoice> = {}) =>
      remoteInvoice({
        id: "in_recovered",
        status: "draft",
        metadata: { sswsco_invoice_id: "inv-1", sswsco_invoice_number: "QA-000001" },
        ...overrides,
      });

    it("links the draft back by its own metadata", async () => {
      const { fake, client } = db({ invoices: [orphan()] });
      const saved = await applyStripeInvoiceSnapshot(client, withMetadata());
      expect(saved?.id).toBe("inv-1");
      expect(fake.tables.invoices[0].stripe_invoice_id).toBe("in_recovered");
    });

    it("refuses to adopt a remote invoice whose amount disagrees", async () => {
      const { fake, client } = db({ invoices: [orphan()] });
      const saved = await applyStripeInvoiceSnapshot(client, withMetadata({ amount_due: 999 }));
      expect(saved).toBeNull();
      expect(fake.tables.invoices[0].stripe_invoice_id).toBeNull();
    });

    it("refuses to adopt anything but an unsent draft", async () => {
      const { client } = db({ invoices: [localInvoice({ status: "open", stripe_invoice_id: null })] });
      expect(await applyStripeInvoiceSnapshot(client, withMetadata({ status: "open" }))).toBeNull();
    });

    it("refuses a currency this ledger does not bill in", async () => {
      const { client } = db({ invoices: [orphan()] });
      expect(await applyStripeInvoiceSnapshot(client, withMetadata({ currency: "cad" }))).toBeNull();
    });
  });
});

describe("reconcileNonterminalInvoices", () => {
  beforeEach(() => retrieve.mockReset());

  it("refreshes only the invoices that can still move", async () => {
    const fake = fakeAdminClient({
      invoices: [
        localInvoice({ id: "inv-open", stripe_invoice_id: "in_open", status: "open" }),
        localInvoice({ id: "inv-paid", stripe_invoice_id: "in_paid", status: "paid" }),
        localInvoice({ id: "inv-void", stripe_invoice_id: "in_void", status: "void" }),
        localInvoice({ id: "inv-unsent", stripe_invoice_id: null, status: "draft" }),
      ],
    });
    adminClient = fake.client;
    retrieve.mockImplementation(async (id: string) => remoteInvoice({ id }));

    const summary = await reconcileNonterminalInvoices();
    expect(summary.checked).toBe(1);
    expect(summary.reconciled).toBe(1);
    expect(summary.differences).toEqual([]);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith("in_open");
  });

  it("reports the invoices it could not reach instead of failing the run", async () => {
    const fake = fakeAdminClient({
      invoices: [
        localInvoice({ id: "inv-a", stripe_invoice_id: "in_a", status: "open" }),
        localInvoice({ id: "inv-b", stripe_invoice_id: "in_b", status: "open" }),
      ],
    });
    adminClient = fake.client;
    retrieve.mockImplementation(async (id: string) => {
      if (id === "in_b") throw new Error("Stripe is unreachable");
      return remoteInvoice({ id });
    });

    const summary = await reconcileNonterminalInvoices();
    expect(summary.checked).toBe(2);
    expect(summary.reconciled).toBe(1);
    expect(summary.differences).toEqual(["in_b"]);
  });
});
