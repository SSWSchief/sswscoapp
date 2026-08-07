import { describe, expect, it } from "vitest";
import { effectivePermissions } from "./permissions";
import type { User } from "./types";

const user: User = {
  id: "1",
  employeeId: "E1",
  fullName: "Driver One",
  email: "d@example.com",
  phone: "",
  role: "driver",
  accessRole: "driver",
  permissionOverrides: {},
  status: "active",
  initials: "DO",
};

describe("effectivePermissions", () => {
  it("uses role defaults", () => {
    const permissions = effectivePermissions(user);
    expect(permissions.driver_jobs).toBe(true);
    expect(permissions.employees).toBe(false);
  });
  it("applies explicit overrides last", () => {
    const permissions = effectivePermissions({
      ...user,
      permissionOverrides: { driver_jobs: false, customers: true },
    });
    expect(permissions.driver_jobs).toBe(false);
    expect(permissions.customers).toBe(true);
  });
});
