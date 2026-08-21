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
    new Request(
      "https://sswscoapp-silver-state-waste-solutions.vercel.app/api/admin/employees/matthew/invite",
      {
        method: "POST",
      },
    ),
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
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sswscoapp.vercel.app");
    supabase = fakeAdminClient({ users: [employee()] });

    const response = await invite();

    expect(response.status).toBe(200);
  });

  it("points the reset at the configured address, not the host it was called on", async () => {
    // `invite()` calls this route on an SSO-protected alias. Deriving the link
    // from the request origin is how an administrator emailed an employee a
    // Vercel login page.
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sswscoapp.vercel.app");
    supabase = fakeAdminClient({ users: [employee()] });

    await invite();

    expect(supabase.authCalls).toEqual([
      {
        method: "resetPasswordForEmail",
        email: "matthew@sswsco.com",
        redirectTo:
          "https://sswscoapp.vercel.app/auth/confirm?next=%2Freset-password",
      },
    ]);
  });

  it("sends nothing when there is no public address to link to", async () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    supabase = fakeAdminClient({ users: [employee()] });

    const result = await failure(await invite());

    expect(result.status).toBe(500);
    expect(result.code).toBe("app_url_unconfigured");
    expect(supabase.authCalls).toEqual([]);
  });
});
