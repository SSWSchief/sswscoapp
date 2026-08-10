import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "./temporary-password";
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
});

describe("employee delivery choice", () => {
  const base = {
    employeeId: "E-1",
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    role: "driver",
    accessRole: "driver",
  };

  it("defaults to invitation so existing callers are unchanged", () => {
    const parsed = employeeCreateSchema.parse(base);
    expect(parsed.delivery).toBe("invitation");
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
