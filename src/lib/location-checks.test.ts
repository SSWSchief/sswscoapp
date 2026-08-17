import { describe, expect, it } from "vitest";
import {
  assetCheckKey,
  checkFreshness,
  latestCheckByAsset,
} from "./location-checks";
import type { AssetLocationCheck } from "./types";

const now = new Date("2026-08-13T12:00:00Z").getTime();

function check(overrides: Partial<AssetLocationCheck> = {}): AssetLocationCheck {
  return {
    id: "c1",
    truckId: "t1",
    dumpsterId: null,
    source: "airtag",
    location: "Yard",
    note: "",
    checkedById: "u1",
    checkedAt: "2026-08-13T11:00:00Z",
    ...overrides,
  };
}

describe("checkFreshness", () => {
  it("reports never confirmed when no check exists", () => {
    expect(checkFreshness(undefined, now)).toBe("none");
  });
  it("treats an unparseable timestamp as unknown rather than fresh", () => {
    expect(checkFreshness(check({ checkedAt: "not-a-date" }), now)).toBe("none");
  });
  it("grades by age against the 24h and 72h thresholds", () => {
    const at = (iso: string) => checkFreshness(check({ checkedAt: iso }), now);
    expect(at("2026-08-13T11:00:00Z")).toBe("fresh");
    expect(at("2026-08-12T13:00:00Z")).toBe("fresh");
    expect(at("2026-08-12T11:00:00Z")).toBe("aging");
    expect(at("2026-08-10T13:00:00Z")).toBe("aging");
    expect(at("2026-08-10T11:00:00Z")).toBe("stale");
  });
});

describe("latestCheckByAsset", () => {
  it("keeps only the most recent check per asset", () => {
    const latest = latestCheckByAsset([
      check({ id: "a", checkedAt: "2026-08-11T10:00:00Z", location: "Old" }),
      check({ id: "b", checkedAt: "2026-08-13T10:00:00Z", location: "New" }),
      check({ id: "c", checkedAt: "2026-08-12T10:00:00Z", location: "Mid" }),
    ]);
    expect(latest.get(assetCheckKey("truck", "t1"))?.location).toBe("New");
  });
  it("separates trucks from dumpsters sharing an id", () => {
    const latest = latestCheckByAsset([
      check({ id: "a", truckId: "x", location: "Truck spot" }),
      check({ id: "b", truckId: null, dumpsterId: "x", location: "Bin spot" }),
    ]);
    expect(latest.get(assetCheckKey("truck", "x"))?.location).toBe("Truck spot");
    expect(latest.get(assetCheckKey("dumpster", "x"))?.location).toBe(
      "Bin spot",
    );
  });
  it("breaks identical timestamps deterministically", () => {
    const rows = [
      check({ id: "a", location: "First" }),
      check({ id: "b", location: "Second" }),
    ];
    const key = assetCheckKey("truck", "t1");
    expect(latestCheckByAsset(rows).get(key)?.location).toBe("Second");
    expect(latestCheckByAsset([...rows].reverse()).get(key)?.location).toBe(
      "Second",
    );
  });
  it("ignores rows that reference no asset", () => {
    expect(
      latestCheckByAsset([check({ truckId: null, dumpsterId: null })]).size,
    ).toBe(0);
  });
});
