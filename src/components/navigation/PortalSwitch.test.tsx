import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalSwitch } from "./PortalSwitch";
import type { User } from "@/lib/types";

const state = { pathname: "/management", currentUser: null as User | null };

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({ currentUser: state.currentUser }),
}));

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

const portalNames = () =>
  screen.queryAllByRole("link").map((link) => link.textContent);

describe("PortalSwitch", () => {
  // The shared setup file does not register auto-cleanup, so renders would
  // otherwise stack up and make every query ambiguous.
  afterEach(cleanup);
  beforeEach(() => {
    state.pathname = "/management";
    state.currentUser = null;
  });

  it("names every portal an owner can open", () => {
    state.currentUser = user({});
    render(<PortalSwitch />);
    expect(portalNames()).toEqual(["Management", "Dispatch", "Driver"]);
    expect(screen.getByText("Portals")).toBeInTheDocument();
  });

  it("marks the portal the user is currently in", () => {
    state.currentUser = user({});
    state.pathname = "/driver/pre-trip";
    render(<PortalSwitch />);
    expect(screen.getByRole("link", { name: "Driver" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Dispatch" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing for a driver, who has only one portal", () => {
    state.currentUser = user({ role: "driver", accessRole: "driver" });
    state.pathname = "/driver/jobs";
    const { container } = render(<PortalSwitch />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a default dispatcher", () => {
    state.currentUser = user({ role: "dispatcher", accessRole: "dispatcher" });
    const { container } = render(<PortalSwitch />);
    expect(container).toBeEmptyDOMElement();
  });

  it("appears for a dispatcher granted driver access", () => {
    state.currentUser = user({
      role: "dispatcher",
      accessRole: "dispatcher",
      permissionOverrides: { driver_jobs: true },
    });
    render(<PortalSwitch />);
    expect(portalNames()).toEqual(["Dispatch", "Driver"]);
  });

  it("renders nothing before the signed-in user has loaded", () => {
    const { container } = render(<PortalSwitch />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each portal at its entry route", () => {
    state.currentUser = user({});
    render(<PortalSwitch />);
    expect(screen.getByRole("link", { name: "Management" })).toHaveAttribute(
      "href",
      "/management",
    );
    expect(screen.getByRole("link", { name: "Dispatch" })).toHaveAttribute(
      "href",
      "/dispatcher/dashboard",
    );
    expect(screen.getByRole("link", { name: "Driver" })).toHaveAttribute(
      "href",
      "/driver/jobs",
    );
  });
});
