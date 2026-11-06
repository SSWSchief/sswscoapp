import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, access, adminClient } = vi.hoisted(() => ({
  rpc: vi.fn(), access: vi.fn(), adminClient: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: access }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: adminClient }));
vi.mock("@/lib/logger", () => ({ log: () => {} }));
const { DELETE } = await import("./route");

const remove = (body: unknown = { confirmationEmail: "driver@example.com" }, id = "driver") =>
  DELETE(new Request(`https://app.sswsco.com/api/admin/employees/${id}`, {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  access.mockResolvedValue({ ok: true, actor: { id: "admin", access_role: "admin" }, client: { rpc }, status: 200 });
  rpc.mockImplementation(async (name: string) => ({
    data: name === "consume_api_rate_limit" ? true : { deleted: true }, error: null,
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("DELETE /api/admin/employees/[id]", () => {
  it.each([401, 403])("rejects unauthenticated or unauthorized callers (%s)", async (status) => {
    access.mockResolvedValue({ ok: false, error: "Access denied", status });
    expect((await remove()).status).toBe(status);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires explicit email confirmation and rejects unrelated fields", async () => {
    expect((await remove({})).status).toBe(400);
    expect((await remove({ confirmationEmail: "driver@example.com", force: true })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks self-deletion before any database mutation", async () => {
    expect((await remove(undefined, "admin")).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the caller's authorized transactional RPC, never the service client", async () => {
    const response = await remove();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "driver", deleted: true } });
    expect(rpc).toHaveBeenCalledWith("permanently_delete_employee", {
      target_user_id: "driver", confirmation_email: "driver@example.com",
    });
    expect(adminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["administrator_protected", 409, "Protected administrators"],
    ["employee_has_history", 409, "Deactivate"],
    ["employee_has_files", 409, "uploaded files"],
    ["confirmation_mismatch", 409, "email does not match"],
    ["employee_not_found", 404, "not found"],
    ["forbidden", 403, "Administrator access"],
    ["last_admin", 409, "active administrator"],
  ])("explains database refusal %s", async (code, status, message) => {
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { deleted: false, code }, error: null });
    const response = await remove();
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message).toContain(message);
  });

  it("does not delete when the rate limit is exhausted or unavailable", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await remove()).status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockClear().mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    expect((await remove()).status).toBe(503);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("never reports success for a database error or malformed outcome", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
    const response = await remove();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
    rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect((await remove()).status).toBe(500);
  });
});
