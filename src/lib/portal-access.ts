import {
  driverPrimaryNav,
  driverSecondaryNav,
  staffNavItems,
} from "@/components/navigation/routes";
import type { IconName } from "@/components/ui/Icon";
import type { AccessRole, PermissionKey } from "./types";

const driverNavItems = [...driverPrimaryNav, ...driverSecondaryNav];

const routePermissions: { prefix: string; key: PermissionKey }[] = [
  ...staffNavItems,
  ...driverNavItems,
].map((item) => ({ prefix: item.href, key: item.permission }));

export function routePermissionFor(path: string) {
  return routePermissions.find((route) => path.startsWith(route.prefix));
}

/**
 * Whether the portal a path belongs to may be entered by this access role.
 *
 * Owners and other administrators drive too, so the driver portal is not
 * reserved for `driver` accounts. Every driver route is permission-gated
 * (`driver_jobs`, `pre_trip`, …), and admins hold every permission by default
 * while a dispatcher can be granted one from Employees, so the permission
 * check — not the access role — is the real gate. Callers must still confirm
 * the route permission itself; this only decides portal ownership.
 */
export function portalAllowsRole(path: string, accessRole: AccessRole) {
  if (path.startsWith("/driver"))
    return accessRole === "driver" || routePermissionFor(path) !== undefined;
  if (path.startsWith("/dispatcher")) return accessRole !== "driver";
  if (path.startsWith("/management")) return accessRole === "admin";
  return false;
}

/**
 * Landing routes in the order each role should be tried, so a user always ends
 * up on the first page they are actually allowed to open. Admins start at
 * Management; drivers never fall back into the staff portal.
 */
export function landingRoutes(accessRole: AccessRole) {
  if (accessRole === "driver")
    return driverNavItems.map((item) => ({
      path: item.href,
      key: item.permission,
    }));
  const staff =
    accessRole === "admin"
      ? [...staffNavItems].sort((left, right) =>
          left.href === "/management"
            ? -1
            : right.href === "/management"
              ? 1
              : 0,
        )
      : staffNavItems.filter((item) => !item.href.startsWith("/management"));
  return staff.map((item) => ({ path: item.href, key: item.permission }));
}

/**
 * The three portals by the names people actually use for them. The nav labels
 * pages, not portals, so an owner told to "check the dispatch portal" had no
 * word to look for — these give the switcher something to say.
 */
const portals: {
  id: "management" | "dispatch" | "driver";
  label: string;
  href: string;
  prefix: string;
  permission: PermissionKey;
  icon: IconName;
}[] = [
  {
    id: "management",
    label: "Management",
    href: "/management",
    prefix: "/management",
    permission: "management",
    icon: "reports",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    href: "/dispatcher/dashboard",
    prefix: "/dispatcher",
    permission: "dashboard",
    icon: "jobs",
  },
  {
    id: "driver",
    label: "Driver",
    href: "/driver/jobs",
    prefix: "/driver",
    permission: "driver_jobs",
    icon: "truck",
  },
];

/**
 * Portals this account may actually open. Anyone left with a single portal —
 * every driver, and dispatchers unless an admin grants them driver access —
 * has nothing to switch between, so callers should hide the switcher then.
 */
export function availablePortals(
  accessRole: AccessRole,
  permissions: Partial<Record<PermissionKey, boolean>>,
) {
  return portals.filter(
    (portal) =>
      portalAllowsRole(portal.href, accessRole) &&
      permissions[portal.permission] === true,
  );
}
