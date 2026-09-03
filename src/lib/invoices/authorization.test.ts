import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { user: null as { id: string } | null, permission: false, permissionError: null as Error | null };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc: async () => ({ data: state.permission, error: state.permissionError }),
  }),
}));
const { invoiceSession } = await import("./authorization");

describe("invoiceSession", () => {
  beforeEach(() => { state.user = null; state.permission = false; state.permissionError = null; });
  it("rejects anonymous access", async () => {
    expect(await invoiceSession()).toMatchObject({ ok: false, reason: "unauthorized" });
  });
  it("rejects an authenticated permission-holder mismatch", async () => {
    state.user = { id: "user-1" };
    expect(await invoiceSession()).toMatchObject({ ok: false, reason: "forbidden" });
  });
  it("allows any authenticated holder of the invoices permission", async () => {
    state.user = { id: "office-1" }; state.permission = true;
    expect(await invoiceSession()).toMatchObject({ ok: true, user: { id: "office-1" } });
  });
});
