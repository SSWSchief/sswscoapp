import { describe, expect, it } from "vitest";
import {
  availablePortals,
  landingRoutes,
  portalAllowsRole,
  routePermissionFor,
} from "./portal-access";
import { effectivePermissions } from "./permissions";
import type { User } from "./types";

const user = (overrides: Partial<User>): User => ({
  id: "1",
  employeeId: "E1",
  fullName: "Austin Marshall",
  email: "amarshall@sswsco.com",
  phone: "",
  role: "management",
  accessRole: "admin",
  permissionOverrides: {},
  status: "active",
  initials: "AM",
  ...overrides,
});

describe("routePermissionFor", () => {
  it("matches nested routes by prefix", () => {
    expect(routePermissionFor("/driver/jobs/job-1")?.key).toBe("driver_jobs");
    expect(routePermissionFor("/dispatcher/trucks/t-1")?.key).toBe("trucks");
  });
  it("returns nothing for unknown routes", () => {
    expect(routePermissionFor("/driver/unknown")).toBeUndefined();
  });
});

describe("portalAllowsRole", () => {
  it("lets admins into the driver portal alongside staff pages", () => {
    expect(portalAllowsRole("/driver/jobs", "admin")).toBe(true);
    expect(portalAllowsRole("/driver/pre-trip", "admin")).toBe(true);
    expect(portalAllowsRole("/management", "admin")).toBe(true);
  });
  it("keeps drivers out of the staff portals", () => {
    expect(portalAllowsRole("/dispatcher/dashboard", "driver")).toBe(false);
    expect(portalAllowsRole("/management", "driver")).toBe(false);
    expect(portalAllowsRole("/driver/jobs", "driver")).toBe(true);
  });
  it("keeps management off limits to dispatchers", () => {
    expect(portalAllowsRole("/management", "dispatcher")).toBe(false);
    expect(portalAllowsRole("/dispatcher/jobs", "dispatcher")).toBe(true);
  });
  it("defers driver routes to the permission gate for non-drivers", () => {
    // Ungated driver routes stay closed to non-drivers; drivers still get in.
    expect(portalAllowsRole("/driver/unknown", "dispatcher")).toBe(false);
    expect(portalAllowsRole("/driver/unknown", "driver")).toBe(true);
    expect(portalAllowsRole("/driver/jobs", "dispatcher")).toBe(true);
  });
  it("rejects paths outside every portal", () => {
    expect(portalAllowsRole("/login", "admin")).toBe(false);
  });
});

describe("landingRoutes", () => {
  it("sends admins to management first", () => {
    expect(landingRoutes("admin")[0].path).toBe("/management");
  });
  it("omits management for dispatchers", () => {
    expect(
      landingRoutes("dispatcher").some((r) => r.path === "/management"),
    ).toBe(false);
  });
  it("keeps drivers on driver routes", () => {
    expect(
      landingRoutes("driver").every((r) => r.path.startsWith("/driver")),
    ).toBe(true);
  });
});

describe("availablePortals", () => {
  const ids = (value: User) =>
    availablePortals(value.accessRole, effectivePermissions(value)).map(
      (portal) => portal.id,
    );

  it("gives owners all three portals by name", () => {
    expect(ids(user({}))).toEqual(["management", "dispatch", "driver"]);
  });
  it("leaves drivers with only their own portal", () => {
    expect(ids(user({ role: "driver", accessRole: "driver" }))).toEqual([
      "driver",
    ]);
  });
  it("leaves a default dispatcher with only dispatch", () => {
    expect(
      ids(user({ role: "dispatcher", accessRole: "dispatcher" })),
    ).toEqual(["dispatch"]);
  });
  it("adds the driver portal for a dispatcher granted driver jobs", () => {
    expect(
      ids(
        user({
          role: "dispatcher",
          accessRole: "dispatcher",
          permissionOverrides: { driver_jobs: true },
        }),
      ),
    ).toEqual(["dispatch", "driver"]);
  });
  it("drops portals whose permission was revoked", () => {
    expect(ids(user({ permissionOverrides: { management: false } }))).toEqual([
      "dispatch",
      "driver",
    ]);
  });
  it("points each portal at a route that role may open", () => {
    for (const portal of availablePortals(
      "admin",
      effectivePermissions(user({})),
    ))
      expect(portalAllowsRole(portal.href, "admin")).toBe(true);
  });
});
