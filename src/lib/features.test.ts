import { describe, expect, it } from "vitest";
import { futureFeatures } from "./features";

describe("future feature registry", () => {
  it("keeps every future module disabled and honestly labeled", () => {
    expect(Object.values(futureFeatures)).toHaveLength(8);
    for (const feature of Object.values(futureFeatures)) { expect(feature.enabled).toBe(false); expect(feature.phase).toBe("future"); expect(feature.title).toBeTruthy(); expect(feature.description).toBeTruthy(); }
  });
});
