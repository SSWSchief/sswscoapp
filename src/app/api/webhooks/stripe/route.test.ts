import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsec_test_secret_for_signing";

// A real Stripe instance: constructEvent is local crypto and never touches the
// network, so the signature this test produces is verified for real.
const stripe = new Stripe("sk_test_not_a_real_key");

const db = {
  row: null as Record<string, unknown> | null,
  lookupError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  patched: null as Record<string, unknown> | null,
};

vi.mock("@/lib/stripe/client", () => ({
  createStripeClient: () => stripe,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: db.row,
            error: db.lookupError,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        db.patched = patch;
        return { eq: async () => ({ error: db.updateError }) };
      },
    }),
  }),
}));

const { POST } = await import("./route");

const send = async (
  type: string,
  invoice: Record<string, unknown>,
  signed = true,
) => {
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type,
    data: { object: { object: "invoice", ...invoice } },
  });
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signed) {
    headers["stripe-signature"] = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: SECRET,
    });
  }
  const response = await POST(
    new Request("https://example.test/api/webhooks/stripe", {
      method: "POST",
      headers,
      body: payload,
    }),
  );
  return { status: response.status, body: await response.json() };
};

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    db.row = {
      id: "inv-1",
      status: "sent",
      due_date: "2026-09-30",
    };
    db.lookupError = null;
    db.updateError = null;
    db.patched = null;
  });

  it("reports a deployment that never received its signing secret", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { status, body } = await send("invoice.paid", { id: "in_1" }, false);
    // 500, not 400: this is our misconfiguration, and Stripe should retry
    // rather than treat the event as malformed and drop it.
    expect(status).toBe(500);
    expect(body.error.code).toBe("webhook_not_configured");
    expect(db.patched).toBeNull();
  });

  it("refuses a request carrying no signature", async () => {
    const { status, body } = await send("invoice.paid", { id: "in_1" }, false);
    expect(status).toBe(400);
    expect(body.error.code).toBe("missing_signature");
    expect(db.patched).toBeNull();
  });

  it("refuses a payload whose signature does not match", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_a_different_secret";
    const { status, body } = await send("invoice.paid", { id: "in_1" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_signature");
    expect(db.patched).toBeNull();
  });

  it("marks an invoice paid and stores what Stripe settled", async () => {
    const { status, body } = await send("invoice.paid", {
      id: "in_1",
      status: "paid",
      amount_paid: 40000,
      hosted_invoice_url: "https://pay.stripe.com/i/abc",
      invoice_pdf: "https://pay.stripe.com/i/abc.pdf",
    });
    expect(status).toBe(200);
    expect(body.data.applied).toBe("invoice.paid");
    expect(db.patched).toMatchObject({
      status: "paid",
      amount_paid_cents: 40000,
      hosted_invoice_url: "https://pay.stripe.com/i/abc",
      invoice_pdf_url: "https://pay.stripe.com/i/abc.pdf",
    });
  });

  it("does not walk a paid invoice back when a stale event replays", async () => {
    db.row = { id: "inv-1", status: "paid", due_date: "2026-09-30" };
    await send("invoice.sent", { id: "in_1", status: "open", amount_paid: 0 });
    expect(db.patched).not.toHaveProperty("status");
  });

  it("acknowledges an event type it does not handle", async () => {
    const { status, body } = await send("customer.created", { id: "cus_1" });
    expect(status).toBe(200);
    expect(body.data.ignored).toBe("customer.created");
    expect(db.patched).toBeNull();
  });

  it("acknowledges an invoice this system never issued", async () => {
    db.row = null;
    const { status, body } = await send("invoice.paid", {
      id: "in_unknown",
      status: "paid",
    });
    // 200, not an error: a non-2xx would have Stripe retry this forever.
    expect(status).toBe(200);
    expect(body.data.ignored).toBe("unknown_invoice");
  });

  it("reports a database failure so Stripe retries", async () => {
    db.lookupError = { message: "boom" };
    const { status, body } = await send("invoice.paid", {
      id: "in_1",
      status: "paid",
    });
    expect(status).toBe(500);
    expect(body.error.code).toBe("lookup_failed");
  });
});
