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
  it("accepts a one-off invoice with no job behind it", () => {
    const oneOff = { ...valid, billingMode: "one_off", jobIds: [], items: [{ description: "Container damage recovery", amountCents: 25000, jobId: null, category: "fee" }] };
    expect(invoiceDraftSchema.safeParse(oneOff).success).toBe(true);
  });
  it("refuses a one-off that carries jobs, and a statement that carries none", () => {
    // The mode is the only thing that relaxes the job requirement, so a
    // statement cannot become jobless just by having its selections dropped.
    expect(invoiceDraftSchema.safeParse({ ...valid, billingMode: "one_off" }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, billingMode: "statement", jobIds: [], items: [{ ...valid.items[0], jobId: null }] }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, jobIds: [], items: [{ ...valid.items[0], jobId: null }] }).success).toBe(false);
  });
  it("requires every line source job to belong to the invoice", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], jobId: "job-other" }] }).success).toBe(false);
  });
  it("enforces Stripe-facing field limits", () => {
    expect(invoiceDraftSchema.safeParse({ ...valid, poNumber: "x".repeat(141) }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, notes: "x".repeat(501) }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, items: [{ ...valid.items[0], description: "x".repeat(501) }] }).success).toBe(false);
  });
  it("accepts a typed name and billing details in place of a customer profile", () => {
    const billing = { contactName: "Maria Lopez", email: " Maria@Example.com ", phone: "", addressLine1: "42 Desert Rd", addressLine2: "", city: "Henderson", state: "nv", postalCode: "89002" };
    const parsed = invoiceDraftSchema.safeParse({ ...valid, customerId: "", customerName: "Maria Lopez", billing });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.billing).toMatchObject({ email: "maria@example.com", state: "NV" });
    // Blank billing fields are fine on a draft; sending is what requires them.
    expect(invoiceDraftSchema.safeParse({ ...valid, billing: { ...billing, email: "", postalCode: "" } }).success).toBe(true);
  });
  it("rejects a missing customer and malformed billing details", () => {
    const billing = { contactName: "", email: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "" };
    expect(invoiceDraftSchema.safeParse({ ...valid, customerId: "" }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, billing: { ...billing, email: "not-an-email" } }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, billing: { ...billing, state: "Nevada" } }).success).toBe(false);
    expect(invoiceDraftSchema.safeParse({ ...valid, billing: { ...billing, postalCode: "890" } }).success).toBe(false);
  });
});
