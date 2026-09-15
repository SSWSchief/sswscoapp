import { describe, expect, it } from "vitest";
import {
  canAttemptOperation,
  operationErrorContext,
} from "./connection-policy";

describe("operations connection policy", () => {
  it.each(["ready", "stale"] as const)(
    "allows a server-validated operation while %s",
    (state) => expect(canAttemptOperation(state)).toBe(true),
  );

  it.each(["loading", "offline", "unauthorized", "error"] as const)(
    "keeps operations blocked while %s",
    (state) => expect(canAttemptOperation(state)).toBe(false),
  );

  it("preserves PostgREST diagnostics for production logs", () => {
    expect(
      operationErrorContext({
        code: "42501",
        message: "permission denied",
        details: "row security policy",
        hint: "check grants",
      }),
    ).toEqual({
      code: "42501",
      message: "permission denied",
      details: "row security policy",
      hint: "check grants",
    });
  });
});
