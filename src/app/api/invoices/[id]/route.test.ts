import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  user: { id: "office-1" } as { id: string } | null,
  permission: true,
  deletedId: "inv-draft" as string | null,
  deleteError: null as { message: string } | null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "has_permission") return { data: state.permission, error: null };
      if (name === "consume_api_rate_limit") return { data: true, error: null };
      if (name === "delete_invoice_draft") {
        state.deletedId = args.target_invoice_id as string;
        return state.deleteError
          ? { data: null, error: state.deleteError }
          : { data: state.deletedId, error: null };
      }
      return { data: null, error: null };
    },
  }),
}));

const { DELETE } = await import("./route");

const remove = async (id = "inv-draft") => {
  const response = await DELETE(
    new Request(`https://example.test/api/invoices/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) },
  );
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  state.user = { id: "office-1" };
  state.permission = true;
  state.deletedId = "inv-draft";
  state.deleteError = null;
});

describe("DELETE /api/invoices/[id]", () => {
  it("deletes an authorized unsent draft", async () => {
    const result = await remove();
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ id: "inv-draft" });
    expect(state.deletedId).toBe("inv-draft");
  });

  it("refuses deletion after a draft has entered the Stripe ledger", async () => {
    state.deleteError = { message: "Only unsent drafts can be deleted" };
    const result = await remove();
    expect(result.status).toBe(409);
    expect(result.body.error).toMatchObject({
      code: "invalid_invoice_state",
      message: "Only unsent drafts can be deleted",
    });
  });

  it("keeps controlled training data together", async () => {
    state.deleteError = {
      message: "Training data can only be removed from Settings",
    };
    const result = await remove("training-v1-invoice");
    expect(result.status).toBe(409);
    expect(result.body.error).toMatchObject({
      code: "invalid_invoice_state",
      message: "Training data can only be removed from Settings",
    });
  });

  it("requires authentication and invoice permission", async () => {
    state.user = null;
    expect((await remove()).status).toBe(401);
    state.user = { id: "office-1" };
    state.permission = false;
    expect((await remove()).status).toBe(403);
  });
});
