import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "./temporary-password";
import { passwordProblem } from "./password-policy";
import { employeeCreateSchema } from "./validation";

describe("temporary passwords", () => {
  it("is long enough to satisfy the password rule at /reset-password", () => {
    expect(generateTemporaryPassword().length).toBe(16);
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(12);
  });

  it("refuses to generate anything weaker than the enforced minimum", () => {
    expect(() => generateTemporaryPassword(8)).toThrow(/12/);
  });

  it("omits characters that are misread when written down or read aloud", () => {
    const sample = Array.from({ length: 200 }, () =>
      generateTemporaryPassword(),
    ).join("");
    for (const character of ["0", "O", "1", "l", "I", "5", "S", "2", "Z"])
      expect(sample).not.toContain(character);
  });

  it("does not repeat itself", () => {
    const generated = new Set(
      Array.from({ length: 200 }, () => generateTemporaryPassword()),
    );
    expect(generated.size).toBe(200);
  });

  // Dropping the ambiguous glyphs leaves six digits among forty-nine
  // characters. Drawing every position freely therefore produced a password
  // with no digit about one time in eight — invisible until someone enables the
  // documented complexity requirement, at which point that share of employee
  // onboardings would fail with nothing to point at.
  it("always satisfies the password policy", () => {
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      const password = generateTemporaryPassword();
      expect(passwordProblem(password), password).toBeNull();
    }
  });

  it("satisfies the policy at the shortest permitted length", () => {
    for (let attempt = 0; attempt < 500; attempt += 1)
      expect(passwordProblem(generateTemporaryPassword(12))).toBeNull();
  });

  it("does not leave the guaranteed characters in fixed positions", () => {
    // A shuffle that never moved anything would still pass the policy check
    // while making the first three positions predictable by class.
    const classes = Array.from({ length: 400 }, () =>
      /[A-Z]/.test(generateTemporaryPassword()[0]),
    );
    expect(classes.some(Boolean)).toBe(true);
    expect(classes.some((isUpper) => !isUpper)).toBe(true);
  });

  it("uses the supplied randomness for the shuffle", () => {
    // `randomInt(limit)` is exclusive, so 0 is always in range and forces every
    // swap to target index 0 — a deterministic arrangement we can assert on.
    const password = generateTemporaryPassword(12, () => 0);
    expect(password).toHaveLength(12);
    expect(passwordProblem(password)).toBeNull();
  });
});

describe("employee delivery choice", () => {
  const base = {
    employeeId: "E-1",
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    role: "driver",
    accessRole: "driver",
  };

  it("defaults to the path that works without SMTP", () => {
    // Previously defaulted to `invitation`, which silently failed on every
    // deployment without custom SMTP — a caller that omits the field should
    // land on the mode that always delivers.
    const parsed = employeeCreateSchema.parse(base);
    expect(parsed.delivery).toBe("temporary_password");
  });

  it("accepts the no-email path", () => {
    const parsed = employeeCreateSchema.parse({
      ...base,
      delivery: "temporary_password",
    });
    expect(parsed.delivery).toBe("temporary_password");
  });

  it("rejects an unknown delivery method", () => {
    expect(() =>
      employeeCreateSchema.parse({ ...base, delivery: "carrier_pigeon" }),
    ).toThrow();
  });
});
