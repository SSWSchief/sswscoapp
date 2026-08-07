import { describe, expect, it } from "vitest";
import {
  employeeCreateSchema,
  employeePatchSchema,
  exportQuerySchema,
  jsonBodySizeAllowed,
} from "./validation";

describe("API validation", () => {
  it("rejects incompatible employee roles", () => {
    expect(
      employeeCreateSchema.safeParse({
        employeeId: "1",
        fullName: "Test Driver",
        email: "driver@example.com",
        role: "driver",
        accessRole: "admin",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown permission keys", () => {
    expect(
      employeePatchSchema.safeParse({
        permissionOverrides: { superuser: true },
      }).success,
    ).toBe(false);
  });

  it("rejects inverted export ranges", () => {
    expect(
      exportQuerySchema.safeParse({ from: "2026-08-10", to: "2026-08-01" })
        .success,
    ).toBe(false);
  });

  it("enforces bounded JSON request bodies", () => {
    expect(jsonBodySizeAllowed(new Request("https://example.test", { headers: { "content-length": "32768" } }))).toBe(true);
    expect(jsonBodySizeAllowed(new Request("https://example.test", { headers: { "content-length": "32769" } }))).toBe(false);
  });
});
