import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
const { invoiceWriteError } = await import("./api");

describe("invoiceWriteError", () => {
  it("reads a unique-violation as the job already being billed", () => {
    for (const message of [
      'duplicate key value violates unique constraint "invoice_jobs_one_active_invoice_idx"',
      "UNIQUE constraint failed",
      "This job is already attached to another invoice",
    ]) {
      const failure = invoiceWriteError(new Error(message));
      expect(failure).toMatchObject({ code: "invoice_conflict", status: 409 });
      expect(failure.message).toMatch(/already attached to another active invoice/);
    }
  });

  it("maps a missing invoice to a 404", () => {
    expect(invoiceWriteError(new Error("Invoice not found."))).toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  it("passes a reviewed business rule through to the office verbatim", () => {
    const failure = invoiceWriteError(new Error("Only a draft can be sent."));
    expect(failure).toMatchObject({ code: "invalid_invoice_state", status: 409 });
    expect(failure.message).toBe("Only a draft can be sent.");
  });

  /**
   * The whole point of the allowlist. A dispatcher gets told what they can act
   * on; anything else is a database or Stripe internal, and repeating it on
   * screen would put connection strings and account ids in front of them.
   */
  it("never repeats an unrecognized failure back to the caller", () => {
    for (const leak of [
      'relation "public.invoices" does not exist at character 13',
      "connection to server at 10.0.0.5 port 5432 failed: password authentication failed for user \"postgres\"",
      "Request failed with sk_live_51H8sample",
    ]) {
      const failure = invoiceWriteError(new Error(leak));
      expect(failure).toMatchObject({ code: "invoice_operation_failed", status: 502 });
      expect(failure.message).toBe("The invoice operation could not be completed. Try again.");
    }
  });

  it("handles a thrown value that is not an Error", () => {
    expect(invoiceWriteError({ message: "Only unsent drafts can be edited" })).toMatchObject({
      status: 409,
    });
    expect(invoiceWriteError("something odd")).toMatchObject({ status: 502 });
  });
});
