import { describe, expect, it } from "vitest";
import {
  employeeDisplayStatus,
  employeeStatusLabel,
  employeeStatusTone,
} from "./employee-status";

describe("employeeDisplayStatus", () => {
  it("reads an active employee who has signed in as active", () => {
    expect(
      employeeDisplayStatus({
        status: "active",
        activatedAt: "2026-08-20T15:00:00.000Z",
      }),
    ).toBe("active");
  });

  it("reads an active employee who has never signed in as pending", () => {
    expect(
      employeeDisplayStatus({ status: "active", activatedAt: null }),
    ).toBe("pending");
  });

  it("treats a missing activation stamp as pending", () => {
    // Rows loaded before the column existed, and any mapper that drops it.
    expect(employeeDisplayStatus({ status: "active" })).toBe("pending");
  });

  it("keeps inactive ahead of activation — a deactivated employee who used to sign in is not pending", () => {
    expect(
      employeeDisplayStatus({
        status: "inactive",
        activatedAt: "2026-08-20T15:00:00.000Z",
      }),
    ).toBe("inactive");
    expect(
      employeeDisplayStatus({ status: "inactive", activatedAt: null }),
    ).toBe("inactive");
  });

  it("labels and tones every state", () => {
    for (const state of ["active", "pending", "inactive"] as const) {
      expect(employeeStatusLabel[state]).toBeTruthy();
      expect(employeeStatusTone[state]).toBeTruthy();
    }
  });
});
