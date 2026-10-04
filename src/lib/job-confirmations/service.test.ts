import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

vi.mock("@/lib/app-url", () => ({ resolveAppUrl: () => ({ url: "https://app.sswsco.com", source: "configured" }) }));
const deliver = vi.fn(async () => ({ sent: 0 }));
vi.mock("@/lib/push/deliver", () => ({ deliverPendingNotifications: () => deliver() }));

const { loadConfirmation, respondToConfirmation, sendJobConfirmation } = await import("./service");

interface Sent { to: string[]; subject: string; text: string; reply_to?: string; key: string | null }
let sent: Sent[] = [];
let resendStatus = 200;
const originalKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  sent = [];
  resendStatus = 200;
  process.env.RESEND_API_KEY = "re_test_key";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ ...body, key: new Headers(init.headers).get("idempotency-key") });
    return new Response(JSON.stringify(resendStatus === 200 ? { id: `email_${sent.length}` } : { message: "domain not verified" }), { status: resendStatus });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

const world = (overrides: { job?: Row; customer?: Row; confirmations?: Row[] } = {}) => {
  const fake = fakeAdminClient({
    jobs: [{ id: "job-1", reference: "#1065", customer_id: "cust-1", address: "1 Main St", service_type: "Delivery", dumpster_size: "20 Yard", scheduled_for: "2026-10-08T15:00:00Z", status: "pending", deleted_at: null, ...overrides.job }],
    customers: [{ id: "cust-1", name: "John Evans", email: "john@example.com", billing_email: "", ...overrides.customer }],
    company_settings: [{ company_name: "Silver State Waste Solutions", phone: "7024600726" }],
    job_confirmations: overrides.confirmations ?? [],
    users: [
      { id: "admin", access_role: "admin", status: "active", deleted_at: null },
      { id: "dispatch", access_role: "dispatcher", status: "active", deleted_at: null },
      { id: "driver", access_role: "driver", status: "active", deleted_at: null },
    ],
    notifications: [],
  });
  return { fake, db: fake.client as unknown as SupabaseClient<Database> };
};
const tokenFrom = (text: string) => /confirm\/([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

describe("sending a job confirmation", () => {
  it("emails the customer and keeps only a hash of the link", async () => {
    const { fake, db } = world();
    const result = await sendJobConfirmation(db, { jobId: "job-1", requestedById: "dispatch" });
    expect(result).toMatchObject({ recipient: "john@example.com", error: null });
    expect(sent[0]).toMatchObject({ to: ["john@example.com"], reply_to: "Dispatch@sswsco.com" });
    expect(sent[0].subject).toContain("Job #1065");
    const token = tokenFrom(sent[0].text);
    const stored = fake.tables.job_confirmations[0];
    expect(stored.token_hash).toBe(hash(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored).toMatchObject({ recipient_email: "john@example.com", scheduled_for: "2026-10-08T15:00:00Z", provider_message_id: "email_1" });
    expect(sent[0].key).toBe(`job-confirmation:${stored.id}`);
  });

  it("is off until the app has its own email key", async () => {
    delete process.env.RESEND_API_KEY;
    const { db } = world();
    await expect(sendJobConfirmation(db, { jobId: "job-1", requestedById: null })).rejects.toMatchObject({ problem: "not_configured" });
    expect(sent).toHaveLength(0);
  });

  it("needs an address, and saves one typed for a customer without one", async () => {
    const missing = world({ customer: { email: "" } });
    await expect(sendJobConfirmation(missing.db, { jobId: "job-1", requestedById: null })).rejects.toMatchObject({ problem: "no_email" });
    await expect(sendJobConfirmation(missing.db, { jobId: "job-1", email: "not an email", requestedById: null })).rejects.toMatchObject({ problem: "no_email" });

    const typed = world({ customer: { email: "" } });
    await sendJobConfirmation(typed.db, { jobId: "job-1", email: "jane@example.com", requestedById: null });
    expect(sent[0].to).toEqual(["jane@example.com"]);
    expect(typed.fake.tables.customers[0].email).toBe("jane@example.com");
  });

  it("falls back to the billing email", async () => {
    const { db } = world({ customer: { email: "", billing_email: "ap@example.com" } });
    await sendJobConfirmation(db, { jobId: "job-1", requestedById: null });
    expect(sent[0].to).toEqual(["ap@example.com"]);
  });

  it("does not email about a cancelled or completed job", async () => {
    for (const status of ["cancelled", "complete"]) {
      const { db } = world({ job: { status } });
      await expect(sendJobConfirmation(db, { jobId: "job-1", requestedById: null })).rejects.toMatchObject({ problem: "job_closed" });
    }
  });

  it("replaces the last confirmation and says so when the time changed", async () => {
    const { fake, db } = world({ confirmations: [{ id: "old", job_id: "job-1", token_hash: "x", recipient_email: "john@example.com", scheduled_for: "2026-10-07T15:00:00Z", superseded_at: null }] });
    await sendJobConfirmation(db, { jobId: "job-1", requestedById: null });
    expect(fake.tables.job_confirmations[0].superseded_at).toBeTruthy();
    expect(fake.tables.job_confirmations[1].superseded_at ?? null).toBeNull();
    expect(sent[0].subject).toMatch(/^Updated: /);
  });

  it("records a failed send so dispatch can retry", async () => {
    resendStatus = 422;
    const { fake, db } = world();
    const result = await sendJobConfirmation(db, { jobId: "job-1", requestedById: null });
    expect(result.error).toMatch(/domain not verified/);
    expect(fake.tables.job_confirmations[0].send_error).toMatch(/domain not verified/);
    expect(fake.tables.job_confirmations[0].sent_at ?? null).toBeNull();
  });
});

describe("the customer's answer", () => {
  const sentWorld = async (overrides: Parameters<typeof world>[0] = {}) => {
    const created = world(overrides);
    await sendJobConfirmation(created.db, { jobId: "job-1", requestedById: null });
    const token = tokenFrom(sent[0].text);
    sent = [];
    return { ...created, token };
  };

  it("records a confirmation without bothering dispatch", async () => {
    const { fake, db, token } = await sentWorld();
    await respondToConfirmation(db, token, { action: "confirmed", note: "ignored" });
    expect(fake.tables.job_confirmations[0]).toMatchObject({ response: "confirmed", response_note: "" });
    expect(fake.tables.notifications).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("alerts dispatch in the app and by email when a change is asked for", async () => {
    const { fake, db, token } = await sentWorld();
    await respondToConfirmation(db, token, { action: "change_requested", note: "Friday instead please" });
    expect(fake.tables.job_confirmations[0]).toMatchObject({ response: "change_requested", response_note: "Friday instead please" });
    expect(fake.tables.notifications.map((row) => row.recipient_user_id)).toEqual(["admin", "dispatch"]);
    expect(fake.tables.notifications[0]).toMatchObject({ related_job_id: "job-1", title: "Change requested: #1065" });
    expect(deliver).toHaveBeenCalled();
    expect(sent[0]).toMatchObject({ to: ["Dispatch@sswsco.com"], reply_to: "john@example.com" });
    expect(sent[0].text).toContain("Friday instead please");
  });

  it("refuses an unknown, replaced, or closed link", async () => {
    const { db } = world();
    await expect(respondToConfirmation(db, "A".repeat(43), { action: "confirmed", note: "" })).rejects.toMatchObject({ problem: "not_found" });
    expect(await loadConfirmation(db, "../../etc")).toBeNull();

    const replaced = await sentWorld();
    replaced.fake.tables.job_confirmations[0].superseded_at = "2026-10-05T00:00:00Z";
    await expect(respondToConfirmation(replaced.db, replaced.token, { action: "confirmed", note: "" })).rejects.toMatchObject({ problem: "superseded" });

    const closed = await sentWorld();
    closed.fake.tables.jobs[0].status = "cancelled";
    await expect(respondToConfirmation(closed.db, closed.token, { action: "confirmed", note: "" })).rejects.toMatchObject({ problem: "job_closed" });
  });
});
