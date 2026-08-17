import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminClient, type DatabaseFailure, type Row } from "@/test/supabase-fake";

// Set per test, before the route is called.
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

function request(body: Record<string, unknown>) {
  return new Request("https://sswscoapp.test/api/admin/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      employeeId: "Owner",
      fullName: "Fred Dakake",
      email: "fdakake@sswsco.com",
      phone: "(973) 277-8852",
      role: "management",
      accessRole: "admin",
      ...body,
    }),
  });
}

function employee(overrides: Row = {}): Row {
  return {
    id: "eli",
    employee_id: "Owner",
    full_name: "Eli Montoya",
    email: "eli@sswsco.com",
    status: "active",
    deleted_at: null,
    ...overrides,
  };
}

const duplicate = (constraint: string): DatabaseFailure => ({
  code: "23505",
  message: `duplicate key value violates unique constraint "${constraint}"`,
  details: `Key (${constraint.replace(/^users_|_key$/g, "")})=(x) already exists.`,
});

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

describe("POST /api/admin/employees conflicts", () => {
  it("names the employee holding a duplicate Employee ID", async () => {
    supabase = fakeAdminClient(
      { users: [employee()] },
      { insertError: duplicate("users_employee_id_key") },
    );

    const result = await failure(await POST(request({})));

    expect(result.status).toBe(409);
    expect(result.code).toBe("employee_id_taken");
    expect(result.message).toBe(
      "Employee ID “Owner” is already used by Eli Montoya. Give this employee a different Employee ID.",
    );
  });

  it("explains a holder the employee list does not show", async () => {
    supabase = fakeAdminClient(
      { users: [employee({ deleted_at: "2026-08-01T00:00:00Z" })] },
      { insertError: duplicate("users_employee_id_key") },
    );

    const result = await failure(await POST(request({})));

    expect(result.message).toContain("removed record for Eli Montoya");
    expect(result.message).toContain("does not appear in the employee list");
  });

  it("names the email when that is what collided", async () => {
    supabase = fakeAdminClient(
      {
        users: [
          employee({ employee_id: "005", email: "fdakake@sswsco.com" }),
        ],
      },
      { insertError: duplicate("users_email_key") },
    );

    const result = await failure(await POST(request({ employeeId: "010" })));

    expect(result.code).toBe("email_taken");
    expect(result.message).toContain(
      "The email address fdakake@sswsco.com is already used by Eli Montoya",
    );
  });

  it("rejects an address that differs only in case, which the constraint cannot catch", async () => {
    supabase = fakeAdminClient({
      users: [employee({ employee_id: "005", email: "FDakake@SSWSCO.com" })],
    });

    const result = await failure(await POST(request({ employeeId: "010" })));

    expect(result.status).toBe(409);
    expect(result.code).toBe("email_taken");
    // Nothing was written: the check runs before the insert.
    expect(supabase.inserted).toHaveLength(0);
  });

  it("does not read an underscore in an address as a wildcard", async () => {
    supabase = fakeAdminClient({
      users: [employee({ employee_id: "005", email: "fredxd@sswsco.com" })],
    });

    const response = await POST(
      request({ employeeId: "010", email: "fred_d@sswsco.com" }),
    );

    expect(response.status).toBe(201);
    expect(supabase.inserted).toHaveLength(1);
  });

  it("reports a failure that is not a conflict as what it is", async () => {
    supabase = fakeAdminClient(
      { users: [] },
      { insertError: { code: "08006", message: "connection failure" } },
    );

    const result = await failure(await POST(request({})));

    expect(result.status).toBe(502);
    expect(result.code).toBe("profile_create_failed");
    expect(result.message).not.toContain("already");
  });

  it("stops before writing when existing employees cannot be read", async () => {
    supabase = fakeAdminClient(
      { users: [] },
      { selectError: { code: "08006", message: "connection failure" } },
    );

    const result = await failure(await POST(request({})));

    expect(result.status).toBe(503);
    expect(result.code).toBe("employee_lookup_failed");
    expect(supabase.inserted).toHaveLength(0);
  });

  it("creates the employee and issues a password when nothing collides", async () => {
    supabase = fakeAdminClient({ users: [employee()] });

    const response = await POST(request({ employeeId: "010" }));
    const body = (await response.json()) as {
      data: { id: string; temporaryPassword: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.temporaryPassword).toMatch(/\S/);
    expect(supabase.inserted[0]).toMatchObject({
      employee_id: "010",
      email: "fdakake@sswsco.com",
      initials: "FD",
    });
  });
});
