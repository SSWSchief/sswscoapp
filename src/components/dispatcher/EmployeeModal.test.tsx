import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeModal } from "./EmployeeModal";

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({ canMutate: true, refresh: async () => {} }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Vitest runs without `globals`, so Testing Library never registers its own
// automatic cleanup and rendered trees would otherwise leak between tests.
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Required labels carry a trailing asterisk, so these match on the prefix.
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Employee ID/), "EMP-9");
  await user.type(screen.getByLabelText(/^Full Name/), "Austin Doe");
  await user.type(screen.getByLabelText(/^Email/), "austin@example.com");
}

describe("EmployeeModal onboarding delivery", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
  });

  it("hides the invitation option when email sending is not configured", () => {
    render(<EmployeeModal open onClose={() => {}} />);
    expect(screen.queryByLabelText("How they get in")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Email them an invitation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/No email is sent\. A password is shown once/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Employee" }),
    ).toBeInTheDocument();
  });

  it("offers the invitation option once email sending is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    render(<EmployeeModal open onClose={() => {}} />);
    expect(screen.getByLabelText("How they get in")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Email them an invitation" }),
    ).toBeInTheDocument();
  });

  it("requests a temporary password when email sending is off", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      void init;
      return {
        ok: true,
        json: async () => ({ data: { temporaryPassword: "Swift-Otter-4821" } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.delivery).toBe("temporary_password");
    // Shown once and never retrievable, so it has to survive on screen rather
    // than the modal closing on success.
    expect(screen.getByText("Swift-Otter-4821")).toBeInTheDocument();
  });
});
