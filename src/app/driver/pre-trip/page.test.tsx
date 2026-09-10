import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "./page";
import type { PretripTemplate, Truck } from "@/lib/types";

// Two sections, mirroring the seeded roll-off form's shape rather than its
// length — the grouping behaviour is what matters here, not all fifty items.
const template = {
  id: "tpl-2",
  title: "CDL Roll-Off Truck Pre-Trip Inspection",
  version: 2,
  isPublished: true,
  items: [
    { id: "doc-registration", section: "Documentation & Compliance", label: "Registration" },
    { id: "doc-eld", section: "Documentation & Compliance", label: "ELD" },
    { id: "rolloff-main-cable", section: "SSWS Roll-Off System", label: "Main Cable" },
  ],
} as PretripTemplate;

const trucks = [{ id: "truck-1", number: "T-03", vin: "1FVACWDT4HHJA1234" }] as Truck[];

// The driver chrome pulls in the driver theme context, which this page test has
// no interest in standing up.
vi.mock("@/components/driver/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const submitted: unknown[] = [];
const toasts: string[] = [];

const expanded = {
  pretripTemplates: [template],
  pretripSubmissions: [],
  submitPretrip: async (input: unknown) => {
    submitted.push(input);
    return { ok: true };
  },
};
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({
  useExpandedOperations: () => expanded,
}));

const operations = { trucks, currentUser: { id: "u1", fullName: "Dana Reed" }, canMutate: true };
vi.mock("@/components/system/OperationsProvider", () => ({
  useOperations: () => operations,
}));
vi.mock("@/components/system/ToastProvider", () => ({
  useToast: () => ({ toast: (message: string) => toasts.push(message) }),
}));

const answerAll = async (user: ReturnType<typeof userEvent.setup>, answer: RegExp) => {
  for (const id of ["doc-registration", "doc-eld", "rolloff-main-cable"]) {
    const group = screen.getByRole("group", { name: new RegExp(id.split("-").pop()!, "i") });
    await user.click(within(group).getByRole("radio", { name: answer }));
  }
};

const fillHeader = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.selectOptions(screen.getByLabelText(/Truck/i), "truck-1");
  await user.type(screen.getByLabelText(/Current Mileage/i), "184300");
  await user.type(screen.getByLabelText(/Driver Signature/i), "Dana Reed");
};

describe("driver pre-trip — sectioned roll-off inspection", () => {
  afterEach(() => {
    cleanup();
    submitted.length = 0;
    toasts.length = 0;
  });

  it("groups items under their section heading with per-section progress", async () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Documentation & Compliance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SSWS Roll-Off System" })).toBeInTheDocument();

    const user = userEvent.setup();
    expect(screen.getByText("0/2")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /Registration/i });
    await user.click(within(group).getByRole("radio", { name: /Pass/i }));
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("accepts N/A as an answer and does not treat it as a defect", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await answerAll(user, /N\/A/i);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /Submit Inspection/i }));

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      safeToOperate: true,
      results: { "doc-registration": "na", "doc-eld": "na", "rolloff-main-cable": "na" },
    });
  });

  it("flips safe-to-operate to No on a failure and refuses to submit without a defect note", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await answerAll(user, /Pass/i);
    const group = screen.getByRole("group", { name: /Main Cable/i });
    await user.click(within(group).getByRole("radio", { name: /Fail/i }));
    await fillHeader(user);

    const safe = screen.getByRole("group", { name: /safe to operate/i });
    expect(within(safe).getByRole("radio", { name: "No" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /Submit Inspection/i }));
    expect(submitted).toHaveLength(0);
    expect(toasts.at(-1)).toMatch(/Describe the defect/i);

    await user.type(screen.getByLabelText(/Defects found/i), "Main cable frayed near hook.");
    await user.click(screen.getByRole("button", { name: /Submit Inspection/i }));
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ safeToOperate: false });
  });

  it("carries the truck's VIN onto the submission rather than asking the driver", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await answerAll(user, /Pass/i);
    await fillHeader(user);
    await user.click(screen.getByRole("button", { name: /Submit Inspection/i }));

    expect(submitted[0]).toMatchObject({ vinSnapshot: "1FVACWDT4HHJA1234" });
    expect(screen.queryByLabelText(/VIN/i)).not.toBeInTheDocument();
  });
});
