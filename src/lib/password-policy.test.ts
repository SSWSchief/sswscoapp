import { describe, expect, it } from "vitest";
import {
  MINIMUM_PASSWORD_LENGTH,
  passwordProblem,
  passwordPolicyHint,
  satisfiesPasswordPolicy,
} from "./password-policy";

describe("passwordProblem", () => {
  it("accepts a password meeting every requirement", () => {
    expect(passwordProblem("Correct7Horse9Battery")).toBeNull();
    expect(satisfiesPasswordPolicy("Correct7Horse9Battery")).toBe(true);
  });

  it("rejects the seven-character password the platform accepted", () => {
    // Supabase's own floor is six characters, so this reached the API before
    // the policy existed in one place.
    expect(passwordProblem("short1A")).toBe("Use at least 12 characters.");
  });

  it("rejects a long password with no variety", () => {
    // The previous check was length-only, so twelve identical letters passed.
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("Include an uppercase letter.");
  });

  it("names each missing requirement in turn", () => {
    expect(passwordProblem("alllowercase1")).toBe(
      "Include an uppercase letter.",
    );
    expect(passwordProblem("ALLUPPERCASE1")).toBe(
      "Include a lowercase letter.",
    );
    expect(passwordProblem("NoDigitsAtAllHere")).toBe("Include a number.");
  });

  it("reports length before variety so the first fix is the obvious one", () => {
    expect(passwordProblem("aB1")).toBe("Use at least 12 characters.");
  });

  it("accepts a password exactly at the minimum length", () => {
    const atMinimum = `Abcdefghij1${"k"}`;
    expect(atMinimum).toHaveLength(MINIMUM_PASSWORD_LENGTH);
    expect(passwordProblem(atMinimum)).toBeNull();
  });

  it("rejects one character below the minimum", () => {
    expect(passwordProblem("Abcdefghij1")).toBe("Use at least 12 characters.");
  });

  it("states every requirement in the hint shown to employees", () => {
    expect(passwordPolicyHint).toContain(String(MINIMUM_PASSWORD_LENGTH));
    for (const word of ["uppercase", "lowercase", "number"])
      expect(passwordPolicyHint).toContain(word);
  });
});
