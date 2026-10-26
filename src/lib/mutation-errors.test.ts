import { describe, expect, it } from "vitest";
import { mutationErrorMessage } from "./mutation-errors";

describe("mutationErrorMessage", () => {
  it("passes through the messages this schema raises for people", () => {
    // Every `raise exception` in the migrations arrives as P0001, and those
    // sentences were written to be read — "Company invoice terms are required
    // before sending", "Job photos are required before completion".
    expect(
      mutationErrorMessage({
        code: "P0001",
        message: "Company invoice terms are required before sending.",
      }),
    ).toEqual({
      code: "P0001",
      message: "Company invoice terms are required before sending.",
    });
  });

  it("leaves the messages our own API and providers write for people alone", () => {
    // The invoice routes answer with their own vocabulary and their own
    // sentences; translating those would replace good words with vague ones.
    expect(
      mutationErrorMessage({
        code: "invalid_invoice_state",
        message: "Only unsent drafts can be edited.",
      }).message,
    ).toBe("Only unsent drafts can be edited.");
    expect(
      mutationErrorMessage(new Error("site-photo.jpg exceeds the 10 MB limit.")).message,
    ).toBe("site-photo.jpg exceeds the 10 MB limit.");
  });

  it("names the field behind a collision dispatch can actually cause", () => {
    expect(
      mutationErrorMessage({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "dumpsters_code_key"',
      }).message,
    ).toMatch(/dumpster already has that code/i);
    expect(
      mutationErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "trucks_number_key"',
      }).message,
    ).toMatch(/truck already has that number/i);
  });

  it("still explains a collision on a constraint it does not know by name", () => {
    const explained = mutationErrorMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "some_new_table_key"',
    });
    expect(explained.message).toMatch(/already exists/i);
    expect(explained.message).not.toMatch(/constraint|violates/i);
  });

  it("says a record is still in use rather than quoting the foreign key", () => {
    expect(
      mutationErrorMessage({
        code: "23503",
        message: 'update or delete on table "trucks" violates foreign key constraint',
      }).message,
    ).toMatch(/still attached to other work/i);
  });

  it("turns a policy refusal into a sentence about permission", () => {
    const denied = mutationErrorMessage({
      code: "42501",
      message: 'new row violates row-level security policy for table "jobs"',
    });
    expect(denied.message).toMatch(/do not have permission/i);
    expect(denied.message).not.toMatch(/row-level security|policy/i);
  });

  it("recognises a policy refusal that arrives without a SQLSTATE", () => {
    expect(
      mutationErrorMessage({
        message: 'new row violates row-level security policy for table "jobs"',
      }).message,
    ).toMatch(/do not have permission/i);
  });

  it("tells someone whose session went stale to sign in again", () => {
    expect(mutationErrorMessage({ code: "PGRST301", message: "JWT expired" }).message).toMatch(
      /sign in again/i,
    );
  });

  it("names a dropped connection, which is what happens in a cab", () => {
    expect(mutationErrorMessage(new TypeError("Failed to fetch")).message).toMatch(
      /connection dropped/i,
    );
  });

  it("falls back to something a person can act on, never to nothing", () => {
    const unknown = mutationErrorMessage({ code: "XX000", message: "internal error" });
    expect(unknown.code).toBe("XX000");
    expect(unknown.message).toMatch(/could not be saved/i);
    expect(mutationErrorMessage(undefined).message).toMatch(/could not be saved/i);
    expect(mutationErrorMessage(null).code).toBe("unexpected_error");
  });

  it("never leaks constraint or table machinery into what a person reads", () => {
    const noisy = [
      { code: "23505", message: 'duplicate key value violates unique constraint "x_key"' },
      { code: "23502", message: 'null value in column "address" violates not-null constraint' },
      { code: "23514", message: 'new row for relation "users" violates check constraint "users_role_check"' },
      { code: "22P02", message: 'invalid input syntax for type integer: "abc"' },
      { code: "XX000", message: "PG::InternalError: something internal" },
    ];
    for (const error of noisy)
      expect(mutationErrorMessage(error).message).not.toMatch(
        /constraint|relation|violates|syntax|null value|PG::/i,
      );
  });
});
