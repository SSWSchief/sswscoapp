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

const { PATCH } = await import("./route");

function employee(overrides: Row = {}): Row {
  return {
    id: "fred",
    employee_id: "010",
    full_name: "Fred Dakake",
    email: "fdakake@sswsco.com",
    phone: "",
    role: "management",
    access_role: "admin",
    status: "active",
    auth_user_id: null,
    deleted_at: null,
    ...overrides,
  };
}

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("https://sswscoapp.test/api/admin/employees/fred", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "fred" }) },
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

describe("PATCH /api/admin/employees/[id] conflicts", () => {
  it("names the employee holding an Employee ID an edit tried to take", async () => {
    supabase = fakeAdminClient(
      {
        users: [
          employee(),
          employee({
            id: "eli",
            employee_id: "Owner",
            full_name: "Eli Montoya",
            email: "eli@sswsco.com",
          }),
        ],
        protected_administrators: [],
      },
      {
        updateError: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "users_employee_id_key"',
        },
      },
    );

    const result = await failure(await patch({ employeeId: "Owner" }));

    expect(result.status).toBe(409);
    expect(result.code).toBe("employee_id_taken");
    expect(result.message).toContain("already used by Eli Montoya");
  });

  it("keeps the generic wording for a failure that is not a conflict", async () => {
    supabase = fakeAdminClient(
      { users: [employee()], protected_administrators: [] },
      { updateError: { code: "08006", message: "connection failure" } },
    );

    const result = await failure(await patch({ fullName: "Fred D" }));

    expect(result.status).toBe(400);
    expect(result.code).toBe("profile_update_failed");
  });

  it("applies an edit that collides with nothing", async () => {
    supabase = fakeAdminClient({
      users: [employee()],
      protected_administrators: [],
    });

    const response = await patch({ employeeId: "011", fullName: "Fred Dakake" });

    expect(response.status).toBe(200);
    expect(supabase.tables.users[0]).toMatchObject({ employee_id: "011" });
  });
});
