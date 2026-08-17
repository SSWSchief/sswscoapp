import type { AccessRole, PermissionKey, User, UserRole } from "./types";

export const permissionLabels: Record<PermissionKey, string> = {
  management: "Management portal",
  dashboard: "Dispatch dashboard",
  jobs: "Jobs",
  customers: "Customers",
  trucks: "Trucks",
  dumpsters: "Dumpsters",
  vendors: "Vendors",
  employees: "Employees & access",
  time_clock: "Time clock",
  absence: "Absence calendar",
  invoices: "Invoices",
  messages: "Messages",
  map: "Map",
  reports: "Reports",
  settings: "Settings",
  driver_jobs: "Driver My Jobs",
  pre_trip: "Electronic pre-trip",
  sops: "Driver SOPs",
  profile: "Driver profile",
};

export const permissionKeys = Object.keys(permissionLabels) as PermissionKey[];

const enabled = (...keys: PermissionKey[]) =>
  Object.fromEntries(
    permissionKeys.map((key) => [key, keys.includes(key)]),
  ) as Record<PermissionKey, boolean>;

const rolePermissions: Record<
  AccessRole,
  Record<PermissionKey, boolean>
> = {
  admin: enabled(...permissionKeys),
  dispatcher: enabled(
    "dashboard",
    "jobs",
    "customers",
    "trucks",
    "dumpsters",
    "vendors",
    "time_clock",
    "absence",
    "messages",
    "map",
    "reports",
  ),
  driver: enabled(
    "driver_jobs",
    "time_clock",
    "messages",
    "pre_trip",
    "sops",
    "profile",
  ),
};

export function effectivePermissions(
  user: User,
): Record<PermissionKey, boolean> {
  return {
    ...rolePermissions[user.accessRole],
    ...user.permissionOverrides,
  };
}

export const accessRoleLabel: Record<AccessRole, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
};

/**
 * The access an operational role normally carries. Adding an employee asks what
 * they do and derives this, so access is a separate question only where it
 * genuinely differs from the job. The pairing is also a database constraint:
 * drivers and management cannot be given anything else.
 */
export function defaultAccessRole(role: UserRole): AccessRole {
  if (role === "driver") return "driver";
  if (role === "management") return "admin";
  return "dispatcher";
}
