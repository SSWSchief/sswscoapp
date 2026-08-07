import { describe, expect, it } from "vitest";
import { canTransitionJob } from "./job-transitions";

describe("job transitions", () => {
  it("allows the production progression", () => { expect(canTransitionJob("pending", "en_route")).toBe(true); expect(canTransitionJob("en_route", "arrived")).toBe(true); expect(canTransitionJob("arrived", "complete")).toBe(true); });
  it("rejects skips and terminal mutations", () => { expect(canTransitionJob("pending", "complete")).toBe(false); expect(canTransitionJob("complete", "pending")).toBe(false); });
});
