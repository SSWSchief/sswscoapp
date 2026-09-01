import { describe, expect, it } from "vitest";
import {
  invoiceStatusFromStripe,
  shouldApplyStatus,
} from "./invoice-status";

const due = "2026-09-30";

describe("invoiceStatusFromStripe", () => {
  it("passes through the states both systems share", () => {
    expect(invoiceStatusFromStripe("draft", due)).toBe("draft");
    expect(invoiceStatusFromStripe("paid", due)).toBe("paid");
    expect(invoiceStatusFromStripe("void", due)).toBe("void");
  });

  it("treats an uncollectible invoice as closed, not void", () => {
    expect(invoiceStatusFromStripe("uncollectible", due)).toBe("closed");
  });

  it("calls an unpaid invoice sent until its due date passes", () => {
    expect(
      invoiceStatusFromStripe("open", due, new Date("2026-09-20T12:00:00Z")),
    ).toBe("sent");
  });

  it("is still sent on the due date itself", () => {
    expect(
      invoiceStatusFromStripe("open", due, new Date("2026-09-30T18:00:00Z")),
    ).toBe("sent");
  });

  it("becomes overdue once the due date is behind us", () => {
    expect(
      invoiceStatusFromStripe("open", due, new Date("2026-10-01T06:00:00Z")),
    ).toBe("overdue");
  });

  it("falls back to sent rather than guessing on an unusable due date", () => {
    expect(invoiceStatusFromStripe("open", "not-a-date")).toBe("sent");
  });
});

describe("shouldApplyStatus", () => {
  it("ignores an update that changes nothing", () => {
    expect(shouldApplyStatus("sent", "sent")).toBe(false);
  });

  it("lets an unsettled invoice move freely", () => {
    expect(shouldApplyStatus("draft", "sent")).toBe(true);
    expect(shouldApplyStatus("sent", "overdue")).toBe(true);
    expect(shouldApplyStatus("overdue", "paid")).toBe(true);
  });

  it("refuses to walk a paid invoice backwards on a replayed webhook", () => {
    expect(shouldApplyStatus("paid", "sent")).toBe(false);
    expect(shouldApplyStatus("paid", "overdue")).toBe(false);
    expect(shouldApplyStatus("void", "draft")).toBe(false);
  });

  it("still allows one settled state to become another", () => {
    expect(shouldApplyStatus("paid", "void")).toBe(true);
    expect(shouldApplyStatus("closed", "paid")).toBe(true);
  });
});
