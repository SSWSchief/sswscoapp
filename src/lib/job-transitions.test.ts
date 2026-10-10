import { describe, expect, it } from "vitest";
import { canTransitionJob, manualAdvanceTargets } from "./job-transitions";

describe("job transitions", () => {
  it("allows the production progression", () => {
    expect(canTransitionJob("pending", "en_route")).toBe(true);
    expect(canTransitionJob("en_route", "arrived")).toBe(true);
    expect(canTransitionJob("arrived", "complete")).toBe(true);
  });
  it("rejects skips and terminal mutations", () => {
    expect(canTransitionJob("pending", "complete")).toBe(false);
    expect(canTransitionJob("complete", "pending")).toBe(false);
  });
});

describe("manualAdvanceTargets", () => {
  it("offers only later steps, and lets a pending job go straight to complete", () => {
    expect(manualAdvanceTargets("pending")).toEqual(["en_route", "arrived", "complete"]);
    expect(manualAdvanceTargets("en_route")).toEqual(["arrived", "complete"]);
    expect(manualAdvanceTargets("arrived")).toEqual(["complete"]);
  });

  it("offers nothing once a job is closed", () => {
    expect(manualAdvanceTargets("complete")).toEqual([]);
    expect(manualAdvanceTargets("cancelled")).toEqual([]);
  });
});
