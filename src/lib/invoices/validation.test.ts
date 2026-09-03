import { describe, expect, it } from "vitest";
import { invoiceDraftSchema } from "./validation";

const valid = {
  customerId: "customer-1",
  billingMode: "per_job",
  jobIds: ["job-1"],
  paymentTerms: "net_30",
  poNumber: "PO-1",
  notes: "Reviewed",
  items: [{ description: "20 yard delivery", amountCents: 40000, jobId: "job-1", category: "service" }],
};

describe("invoiceDraftSchema", () => {
  it("accepts reviewed per-job and multi-job statement drafts", () => {
    expect(invoiceDraftSchema.safeParse(valid).success).toBe(true);
    expect(invoiceDraftSchema.safeParse({ ...valid, billingMode: "statement", jobIds: ["job-1", "job-2"], items: [...valid.items, { ...valid.items[0], description: "Pickup", jobId: "job-2" }] }).success).toBe(true);
  });
  it("rejects zero lines and unsafe or non-positive totals", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], amountCents: 0 }] }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], amountCents: Number.MAX_SAFE_INTEGER }, { ...valid.items[0], description: "Second", amountCents: 1 }] }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], amountCents: -1, category: "adjustment" }] }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [...valid.items, { ...valid.items[0], description: "Credit", amountCents: -1000, category: "adjustment" }] }).success).toBe(true);
  });
  it("requires exactly one job for per-job invoices", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, jobIds: ["job-1", "job-2"] }).success).toBe(false);
  });
  it("requires every line source job to belong to the invoice", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], jobId: "job-other" }] }).success).toBe(false);
  });
  it("enforces Stripe-facing field limits", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, poNumber: "x".repeat(141) }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, notes: "x".repeat(501) }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], description: "x".repeat(501) }] }).success).toBe(false);
  });
});
