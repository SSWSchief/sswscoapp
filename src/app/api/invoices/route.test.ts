import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

const state = {
  user: null as { id: string } | null,
  permission: true,
  rateLimit: true as boolean | null,
  rateLimitError: null as { message: string } | null,
  draftError: null as { message: string } | null,
  tables: {} as Record<string, Row[]>,
  lastDraftPayload: null as Record<string, unknown> | null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const fake = fakeAdminClient(state.tables);
    return {
      ...fake.client,
      auth: { getUser: async () => ({ data: { user: state.user } }) },
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === "has_permission") return { data: state.permission, error: null };
        if (name === "consume_api_rate_limit")
          return { data: state.rateLimit, error: state.rateLimitError };
        if (name === "create_invoice_draft") {
          state.lastDraftPayload = args.payload as Record<string, unknown>;
          return state.draftError
            ? { data: null, error: state.draftError }
            : { data: { id: "inv-new", invoice_number: "QA-000007" }, error: null };
        }
        return { data: null, error: null };
      },
    };
  },
}));

const { POST } = await import("./route");
const { GET } = await import("./eligible-jobs/route");

const draft = {
  customerId: "cust-1",
  billingMode: "per_job",
  jobIds: ["job-1"],
  paymentTerms: "net_30",
  poNumber: "PO-1",
  notes: "Reviewed",
  items: [{ description: "20 yard delivery", amountCents: 40000, jobId: "job-1", category: "service" }],
};

const post = async (body: unknown) => {
  const response = await POST(
    new Request("https://example.test/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
};

const eligible = async (query: string) => {
  const response = await GET(new Request(`https://example.test/api/invoices/eligible-jobs?${query}`));
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  state.user = { id: "office-1" };
  state.permission = true;
  state.rateLimit = true;
  state.rateLimitError = null;
  state.draftError = null;
  state.lastDraftPayload = null;
  state.tables = {};
});

describe("POST /api/invoices", () => {
  it("creates a draft and returns it as 201", async () => {
    const result = await post(draft);
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ invoice_number: "QA-000007" });
  });

  it("numbers the line items by their submitted order", async () => {
    await post({
      ...draft,
      billingMode: "statement",
      jobIds: ["job-1", "job-2"],
      items: [
        { description: "Haul one", amountCents: 40000, jobId: "job-1", category: "service" },
        { description: "Haul two", amountCents: 25000, jobId: "job-2", category: "service" },
      ],
    });
    expect(state.lastDraftPayload?.items).toMatchObject([{ position: 0 }, { position: 1 }]);
  });

  it("turns a rejected database rule into an actionable conflict", async () => {
    state.draftError = { message: "duplicate key value violates unique constraint" };
    const result = await post(draft);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("invoice_conflict");
  });

  describe("refuses the request", () => {
    it("when nobody is signed in", async () => {
      state.user = null;
      const result = await post(draft);
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe("unauthorized");
    });

    it("when the account has no invoices permission", async () => {
      state.permission = false;
      expect((await post(draft)).status).toBe(403);
    });

    it("when the office has exhausted its hourly writes", async () => {
      state.rateLimit = false;
      const result = await post(draft);
      expect(result.status).toBe(429);
      expect(result.body.error.code).toBe("rate_limited");
    });

    /** An unreadable limiter must close the door, not leave it open. */
    it("when the rate limiter itself cannot be read", async () => {
      state.rateLimitError = { message: "relation does not exist" };
      const result = await post(draft);
      expect(result.status).toBe(503);
      expect(result.body.error.code).toBe("rate_limit_unavailable");
    });

    it("when the body is not JSON or fails validation", async () => {
      expect((await post("{not json")).status).toBe(400);
      expect((await post({ ...draft, items: [] })).status).toBe(400);
      expect((await post({ ...draft, jobIds: ["job-1", "job-2"] })).status).toBe(400);
    });
  });
});

describe("GET /api/invoices/eligible-jobs", () => {
  const jobs = [
    { id: "job-free", reference: "#1", service_type: "Delivery", dumpster_size: "20 Yard", scheduled_for: "2026-09-01", customer_id: "cust-1", status: "complete", deleted_at: null },
    { id: "job-taken", reference: "#2", service_type: "Pickup", dumpster_size: "20 Yard", scheduled_for: "2026-09-02", customer_id: "cust-1", status: "complete", deleted_at: null },
  ];

  it("requires a customer before it will list anything", async () => {
    const result = await eligible("");
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("customer_required");
  });

  it("hides a job that is already on another active invoice", async () => {
    state.tables = {
      jobs,
      invoice_jobs: [{ job_id: "job-taken", invoice_id: "inv-other", active: true }],
      invoices: [],
    };
    const result = await eligible("customerId=cust-1");
    expect(result.body.data.map((job: { id: string }) => job.id)).toEqual(["job-free"]);
  });

  it("keeps a job that is only held by the invoice being edited", async () => {
    state.tables = {
      jobs,
      invoice_jobs: [{ job_id: "job-taken", invoice_id: "inv-mine", active: true }],
      invoices: [{ id: "inv-mine", revised_from_id: null }],
    };
    const result = await eligible("customerId=cust-1&invoiceId=inv-mine");
    expect(result.body.data.map((job: { id: string }) => job.id)).toEqual(["job-free", "job-taken"]);
  });

  /** A revision has to keep the jobs its original still holds. */
  it("keeps the jobs held by the invoice this draft revises", async () => {
    state.tables = {
      jobs,
      invoice_jobs: [{ job_id: "job-taken", invoice_id: "inv-original", active: true }],
      invoices: [{ id: "inv-revision", revised_from_id: "inv-original" }],
    };
    const result = await eligible("customerId=cust-1&invoiceId=inv-revision");
    expect(result.body.data.map((job: { id: string }) => job.id)).toEqual(["job-free", "job-taken"]);
  });

  it("refuses an unauthenticated caller", async () => {
    state.user = null;
    expect((await eligible("customerId=cust-1")).status).toBe(401);
  });
});
