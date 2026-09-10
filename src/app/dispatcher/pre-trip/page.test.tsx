import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import type { PretripSubmission, PretripTemplate, Truck, User } from "@/lib/types";

const template = {
  id: "tpl-2",
  title: "CDL Roll-Off Truck Pre-Trip Inspection",
  version: 1,
  isPublished: true,
  items: [
    { id: "doc-registration", section: "Documentation & Compliance", label: "Registration" },
    { id: "rolloff-main-cable", section: "SSWS Roll-Off System", label: "Main Cable" },
  ],
} as PretripTemplate;

const submission = (overrides: Partial<PretripSubmission> & { id: string }): PretripSubmission => ({
  templateId: "tpl-2",
  driverId: "driver-1",
  truckId: "truck-1",
  mileage: 184300,
  signature: "Dana Reed",
  results: { "doc-registration": "pass", "rolloff-main-cable": "pass" },
  hasFailures: false,
  submittedAt: "2026-09-09T14:00:00Z",
  safeToOperate: true,
  defectsFound: "",
  repairsRequired: "",
  supervisorSignature: "",
  supervisorSignedAt: null,
  vinSnapshot: "1FVACWDT4HHJA1234",
  routeNote: "",
  ...overrides,
});

const state = {
  submissions: [] as PretripSubmission[],
  currentUserId: "sup-1",
};
const countersigned: unknown[] = [];
const toasts: string[] = [];

vi.mock("@/components/dispatcher/Topbar", () => ({
  Topbar: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: () => ({
    pretripSubmissions: state.submissions,
    pretripTemplates: [template],
    countersignPretrip: async (input: unknown) => {
      countersigned.push(input);
      return { ok: true };
    },
    refresh: async () => {},
  }),
}));
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => ({
    trucks: [{ id: "truck-1", number: "T-03" }] as Truck[],
    users: [
      { id: "driver-1", fullName: "Dana Reed" },
      { id: "sup-1", fullName: "Sam Ortiz" },
    ] as User[],
    currentUser: { id: state.currentUserId, fullName: "Sam Ortiz" },
    canMutate: true,
  }),
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: (message: string) => toasts.push(message) }),
}));

describe("dispatcher pre-trip review", () => {
  afterEach(() => {
    cleanup();
    state.submissions = [];
    state.currentUserId = "sup-1";
    countersigned.length = 0;
    toasts.length = 0;
  });

  it("puts an unsigned failed inspection above a newer clean one", () => {
    state.submissions = [
      submission({ id: "clean", submittedAt: "2026-09-10T14:00:00Z" }),
      submission({
        id: "failed",
        submittedAt: "2026-09-08T14:00:00Z",
        hasFailures: true,
        safeToOperate: false,
        results: { "doc-registration": "pass", "rolloff-main-cable": "fail" },
        defectsFound: "Main cable frayed near hook.",
      }),
    ];
    render(<Page />);
    expect(screen.getByText(/1 inspection awaiting a supervisor signature/i)).toBeInTheDocument();

    const badges = screen.getAllByText(/Unsafe|Passed/);
    expect(badges[0]).toHaveTextContent("Unsafe");
  });

  it("shows the answers grouped by section, with N/A distinct from a failure", async () => {
    state.submissions = [
      submission({
        id: "mixed",
        results: { "doc-registration": "na", "rolloff-main-cable": "fail" },
        hasFailures: true,
        safeToOperate: false,
        defectsFound: "Cable frayed.",
      }),
    ];
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByRole("heading", { name: "Documentation & Compliance" })).toBeInTheDocument();
    const registration = screen.getByText("Registration").closest("li")!;
    expect(within(registration).getByText("N/A")).toBeInTheDocument();
    const cable = screen.getByText("Main Cable").closest("li")!;
    expect(within(cable).getByText("Fail")).toBeInTheDocument();
    expect(screen.getByText("Cable frayed.")).toBeInTheDocument();
  });

  it("counter-signs with the supervisor's typed name", async () => {
    state.submissions = [submission({ id: "s1", hasFailures: true, safeToOperate: false, defectsFound: "x" })];
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { expanded: false }));

    await user.click(screen.getByRole("button", { name: /Counter-sign inspection/i }));
    expect(countersigned).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/Enter your name/i);

    await user.type(screen.getByLabelText(/Supervisor signature/i), "Sam Ortiz");
    await user.click(screen.getByRole("button", { name: /Counter-sign inspection/i }));
    expect(countersigned).toEqual([{ submissionId: "s1", signature: "Sam Ortiz" }]);
  });

  it("refuses to offer sign-off to the driver who submitted it", async () => {
    state.currentUserId = "driver-1";
    state.submissions = [submission({ id: "own", hasFailures: true, safeToOperate: false, defectsFound: "x" })];
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { expanded: false }));

    // The second pair of eyes is the entire point of the counter-signature.
    expect(screen.queryByRole("button", { name: /Counter-sign/i })).not.toBeInTheDocument();
    expect(screen.getByText(/needs a different supervisor/i)).toBeInTheDocument();
  });

  it("treats a counter-signed inspection as final", async () => {
    state.submissions = [
      submission({
        id: "done",
        hasFailures: true,
        safeToOperate: false,
        defectsFound: "x",
        supervisorSignature: "Sam Ortiz",
        supervisorSignedAt: "2026-09-09T16:00:00Z",
      }),
    ];
    render(<Page />);
    const user = userEvent.setup();
    expect(screen.getByText(/Every failed inspection has been counter-signed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.queryByRole("button", { name: /Counter-sign/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be\s+replaced/i)).toBeInTheDocument();
  });
});
