import { describe, expect, it } from "vitest";
import { futureFeatures } from "./features";

describe("future feature registry", () => {
  it("marks every expanded module active", () => {
    expect(Object.values(futureFeatures)).toHaveLength(8);
    for (const feature of Object.values(futureFeatures)) { expect(feature.enabled).toBe(true); expect(feature.phase).toBe("active"); expect(feature.title).toBeTruthy(); expect(feature.description).toBeTruthy(); }
  });
});
