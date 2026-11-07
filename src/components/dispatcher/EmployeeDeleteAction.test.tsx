import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeDeleteAction } from "./EmployeeDeleteAction";

const { refresh, replace, toast } = vi.hoisted(() => ({
  refresh: vi.fn(), replace: vi.fn(), toast: vi.fn(),
}));
let actor = { id: "austin", accessRole: "admin" };
let canMutate = true;
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({ currentUser: actor, canMutate, refresh }),
}));
vi.mock("@/components/system/ToastProvider", () => ({ useToast: () => ({ toast }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const employee = { id: "driver", fullName: "Test Driver", email: "driver@example.com" };
const onDeleted = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  actor = { id: "austin", accessRole: "admin" };
  canMutate = true;
  refresh.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = (protectedAdministrator = false) => render(
  <EmployeeDeleteAction employee={employee} protectedAdministrator={protectedAdministrator} onDeleted={onDeleted} />,
);
async function confirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Permanently Delete Employee" }));
}

describe("EmployeeDeleteAction", () => {
  it("keeps deletion out of dispatcher and driver controls", () => {
    actor.accessRole = "dispatcher";
    show();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("explains why protected owners cannot be deleted", () => {
    show(true);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/Protected administrators cannot/)).toBeInTheDocument();
  });
  it("blocks deleting the signed-in administrator", () => {
    actor.id = employee.id;
    show();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/cannot delete your own/)).toBeInTheDocument();
  });
  it("disables deletion when the app cannot mutate", () => {
    canMutate = false;
    show();
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("asks once with no typing, says records are kept, and can be cancelled", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Test Driver");
    expect(screen.getByRole("dialog")).toHaveTextContent("records are kept");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("deletes once, leaves the removed page, and refreshes the list", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ data: { deleted: true } }));
    show();
    await confirm(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dispatcher/employees"));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/admin/employees/driver", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationEmail: employee.email }),
    });
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("keeps a server refusal in the dialog without removing the employee", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ error: { message: "At least one active administrator is required." } }, { status: 409 }));
    show();
    await confirm(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("administrator");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it("handles a network failure without claiming deletion succeeded", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("offline"));
    show();
    await confirm(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh the employee list");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
