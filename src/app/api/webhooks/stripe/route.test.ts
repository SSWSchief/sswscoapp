import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsec_test_secret_for_signing";
const stripe = new Stripe("sk_test_not_a_real_key");
const state = {
  events: new Map<string, Record<string, unknown>>(),
  remote: { id: "in_1", status: "paid", amount_paid: 40000, amount_remaining: 0 } as unknown as Stripe.Invoice,
  invoicePatch: null as Record<string, unknown> | null,
};
const applySnapshot = vi.fn(async (_db: unknown, remote: Stripe.Invoice) => remote.id === "in_unknown" ? null : { id: "inv-1", status: remote.status });
const responseInvoice = () => state.remote as Awaited<ReturnType<typeof stripe.invoices.retrieve>>;

vi.mock("@/lib/stripe/client", () => ({ createStripeClient: () => stripe }));
vi.mock("@/lib/stripe/reconcile", () => ({ applyStripeInvoiceSnapshot: (...args: unknown[]) => applySnapshot(...args as [unknown, Stripe.Invoice]) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (_name: string, args: Record<string, unknown>) => {
      const id = args.stripe_event_id as string;
      const prior = state.events.get(id);
      if (prior && prior.status !== "pending") return { data: prior.status, error: null };
      state.events.set(id, { ...prior, event_id: id, status: "processing", attempts: Number(prior?.attempts ?? 0) + 1 });
      return { data: "claimed", error: null };
    },
    from: (table: string) => table === "stripe_webhook_events" ? {
      update: (patch: Record<string, unknown>) => ({ eq: async (_field: string, value: string) => { state.events.set(value, { ...state.events.get(value), ...patch }); return { error: null }; } }),
    } : {
      update: (patch: Record<string, unknown>) => ({ eq: async () => { state.invoicePatch = patch; return { error: null }; } }),
    },
  }),
}));

const { POST } = await import("./route");
const send = async (type: string, object: Record<string, unknown>, signed = true, id = "evt_1") => {
  const payload = JSON.stringify({ id, object: "event", type, livemode: false, created: 1788400000, data: { object } });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) headers["stripe-signature"] = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const response = await POST(new Request("https://example.test/api/webhooks/stripe", { method: "POST", headers, body: payload }));
  return { status: response.status, body: await response.json() };
};

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    delete process.env.STRIPE_EXPECTED_MODE;
    state.events.clear(); state.invoicePatch = null; applySnapshot.mockClear();
    state.remote = { id: "in_1", status: "paid", amount_paid: 40000, amount_remaining: 0 } as unknown as Stripe.Invoice;
    vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(responseInvoice());
  });
  it("reports missing webhook configuration", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const result = await send("invoice.paid", { id: "in_1" }, false);
    expect(result.status).toBe(500); expect(result.body.error.code).toBe("webhook_not_configured");
  });
  it("requires and verifies the real Stripe signature", async () => {
    expect((await send("invoice.paid", { id: "in_1" }, false)).status).toBe(400);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_wrong";
    expect((await send("invoice.paid", { id: "in_1" })).body.error.code).toBe("invalid_signature");
  });
  it("records the event before retrieving and applying canonical Stripe state", async () => {
    const result = await send("invoice.paid", { id: "in_1", status: "open" });
    expect(result.status).toBe(200); expect(result.body.data.status).toBe("processed");
    expect(applySnapshot).toHaveBeenCalled(); expect(state.events.get("evt_1")?.status).toBe("processed");
  });
  it("derives payment failure from a current open invoice", async () => {
    state.remote = { id: "in_1", status: "open", amount_paid: 1000, amount_remaining: 39000 } as unknown as Stripe.Invoice;
    vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(responseInvoice());
    const result = await send("invoice.payment_failed", { id: "in_1", status: "open" }, true, "evt_failed");
    expect(result.status).toBe(200);
    expect(state.invoicePatch).toMatchObject({ payment_processing_at: null });
    expect(state.invoicePatch?.payment_failed_at).toEqual(expect.any(String));
  });
  it("represents ACH processing without changing the canonical lifecycle", async () => {
    state.remote = { id: "in_1", status: "open", amount_paid: 0, amount_remaining: 40000 } as unknown as Stripe.Invoice;
    vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(responseInvoice());
    vi.spyOn(stripe.invoicePayments, "list").mockResolvedValue({ data: [{ invoice: "in_1" }] } as unknown as Awaited<ReturnType<typeof stripe.invoicePayments.list>>);
    const result = await send("payment_intent.processing", { id: "pi_1", object: "payment_intent" }, true, "evt_processing");
    expect(result.status).toBe(200);
    expect(state.invoicePatch).toMatchObject({ payment_failed_at: null });
    expect(state.invoicePatch?.payment_processing_at).toEqual(expect.any(String));
  });
  it("deduplicates an already processed event", async () => {
    state.events.set("evt_1", { status: "processed" });
    const result = await send("invoice.paid", { id: "in_1" });
    expect(result.body.data.duplicate).toBe("evt_1"); expect(applySnapshot).not.toHaveBeenCalled();
  });
  it("records unsupported and unknown invoices as ignored", async () => {
    expect((await send("customer.created", { id: "cus_1" }, true, "evt_unsupported")).body.data.status).toBe("ignored");
    state.remote = { id: "in_unknown", status: "paid" } as Stripe.Invoice;
    vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(responseInvoice());
    expect((await send("invoice.paid", { id: "in_unknown" }, true, "evt_unknown")).body.data.status).toBe("ignored");
  });
  it("keeps a failed event pending so Stripe retries", async () => {
    applySnapshot.mockRejectedValueOnce(new Error("database unavailable"));
    const result = await send("invoice.paid", { id: "in_1" });
    expect(result.status).toBe(500); expect(state.events.get("evt_1")?.status).toBe("pending");
  });
});
