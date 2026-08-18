import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

let supabase: ReturnType<typeof fakeAdminClient>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => supabase.client,
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({
    ok: true,
    status: 200,
    client: supabase.client,
    actor: { id: "admin-1", access_role: "admin" },
  }),
}));
vi.mock("@/lib/logger", () => ({ log: () => {} }));

const { POST } = await import("./route");

function employee(overrides: Row = {}): Row {
  return { id: "matthew", email: "matthew@sswsco.com", ...overrides };
}

function invite() {
  return POST(
    new Request("https://sswscoapp.test/api/admin/employees/matthew/invite", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "matthew" }) },
  );
}

async function failure(response: Response) {
  const body = (await response.json()) as {
    error: { code: string; message: string };
  };
  return { status: response.status, ...body.error };
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/employees/[id]/invite", () => {
  it("refuses to report success for a reset email the deployment cannot deliver", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
    supabase = fakeAdminClient({ users: [employee()] });

    const result = await failure(await invite());

    expect(result.status).toBe(409);
    expect(result.code).toBe("email_delivery_disabled");
    expect(result.message).toContain("temporary password");
  });

  it("sends the reset once email delivery is actually configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    supabase = fakeAdminClient({ users: [employee()] });

    const response = await invite();

    expect(response.status).toBe(200);
  });
});
