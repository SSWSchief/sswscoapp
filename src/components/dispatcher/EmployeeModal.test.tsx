import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeModal } from "./EmployeeModal";

// The modal reads the loaded employee list to catch duplicates before it asks
// the server. Tests append to this rather than re-mocking the provider.
const employees: {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
}[] = [];

vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({
    canMutate: true,
    refresh: async () => {},
    users: employees,
  }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Vitest runs without `globals`, so Testing Library never registers its own
// automatic cleanup and rendered trees would otherwise leak between tests.
afterEach(() => {
  employees.length = 0;
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Required labels carry a trailing asterisk, so these match on the prefix.
// Employee ID is deliberately left blank: it is assigned for you, and the
// common path through this form never touches it.
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
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

describe("EmployeeModal employee ID", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
  });

  it("creates the employee without one being entered", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      void init;
      return { ok: true, json: async () => ({ data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/^Full Name/), "Norberto Angulo");
    await user.type(screen.getByLabelText(/^Email/), "nangulo@sswsco.com");
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    // Omitted rather than blank, so the server assigns it — the only side that
    // can see soft-deleted employees still holding an ID.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.employeeId).toBeUndefined();
  });

  it("shows what will be assigned as the name is typed", async () => {
    const user = userEvent.setup();
    render(<EmployeeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/^Full Name/), "Norberto Angulo");
    expect(
      screen.getByText(/Assigned automatically — NANGULO/),
    ).toBeInTheDocument();
  });

  it("still sends an ID that was entered by hand", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      void init;
      return { ok: true, json: async () => ({ data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/^Employee ID/), "EMP-014");
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).employeeId).toBe(
      "EMP-014",
    );
  });
});

describe("EmployeeModal roles", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
  });

  it("asks one question and derives the access that follows it", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      void init;
      return { ok: true, json: async () => ({ data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    // Austin's people are owners; the list has to say so somewhere, or the word
    // ends up in whichever box accepts free text.
    await user.selectOptions(
      screen.getByLabelText("What do they do?"),
      "management",
    );
    expect(screen.queryByLabelText("Access Role")).not.toBeInTheDocument();
    expect(screen.getByText(/They get admin access/)).toBeInTheDocument();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create Employee" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.role).toBe("management");
    expect(body.accessRole).toBe("admin");
  });

  it("reveals access as a separate choice on request", async () => {
    const user = userEvent.setup();
    render(<EmployeeModal open onClose={() => {}} />);
    await user.click(
      screen.getByRole("button", { name: "Change what they can see" }),
    );
    expect(screen.getByLabelText("Access Role")).toBeInTheDocument();
  });
});

describe("EmployeeModal duplicate details", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
    employees.push({
      id: "u1",
      employeeId: "Owner",
      fullName: "Eli Montoya",
      email: "eli@sswsco.com",
      status: "active",
    });
  });

  it("names the employee holding a duplicate Employee ID before asking the server", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    // Austin's report: a second person given the Employee ID "Owner" came back
    // as an existing employee, though their name, email, and phone were new.
    await user.type(screen.getByLabelText(/^Employee ID/), "Owner");
    await user.type(screen.getByLabelText(/^Full Name/), "Norberto Angulo");
    await user.type(screen.getByLabelText(/^Email/), "nangulo@sswsco.com");
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "already used by Eli Montoya",
    );
  });

  it("names the employee already holding a reused email address", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/^Full Name/), "Norberto Angulo");
    // Stored lowercase, so a differently-cased retype is the same address.
    await user.type(screen.getByLabelText(/^Email/), "Eli@sswsco.com");
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "already used by Eli Montoya",
    );
  });

  it("clears the conflict once the Employee ID is edited", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<EmployeeModal open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/^Employee ID/), "Owner");
    await user.type(screen.getByLabelText(/^Full Name/), "Norberto Angulo");
    await user.type(screen.getByLabelText(/^Email/), "nangulo@sswsco.com");
    await user.click(screen.getByRole("button", { name: "Create Employee" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "already used by Eli Montoya",
    );

    await user.type(screen.getByLabelText(/^Employee ID/), "-2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pins a server conflict to its field without the support reference", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        headers: new Headers(),
        json: async () => ({
          error: {
            code: "employee_id_taken",
            message:
              "Employee ID \u201cOwner\u201d still belongs to a removed record for Fred Dakake.",
            requestId: "sfo1::abc",
          },
        }),
      })),
    );
    render(<EmployeeModal open onClose={() => {}} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create Employee" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("removed record for Fred Dakake");
    expect(alert.textContent).not.toContain("Reference");
    // The message survives on screen, so it can be read while the field is
    // corrected — and clears as soon as it is.
    await user.type(screen.getByLabelText(/^Employee ID/), "9");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
