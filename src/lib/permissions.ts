import type { AccessRole, PermissionKey, User } from "./types";

export const permissionLabels: Record<PermissionKey, string> = {
  management: "Management portal",
  dashboard: "Dispatch dashboard",
  jobs: "Jobs",
  customers: "Customers",
  trucks: "Trucks",
  dumpsters: "Dumpsters",
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
