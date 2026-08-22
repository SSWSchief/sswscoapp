import { describe, expect, it } from "vitest";
import {
  effectivePermissions,
  permissionGroups,
  permissionKeys,
} from "./permissions";
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

describe("permissionGroups", () => {
  it("covers every permission key exactly once", () => {
    // A key present in permissionLabels but missing here renders nowhere on
    // the employee access page; one listed twice renders there twice. Both
    // are real bugs a reviewer can easily miss when a permission is added.
    const grouped = permissionGroups.flatMap((group) => group.keys);
    expect(grouped.sort()).toEqual([...permissionKeys].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
