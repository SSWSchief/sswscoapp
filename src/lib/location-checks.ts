import type { AssetLocationCheck, LocationCheckSource } from "./types";

/**
 * A location check ages out. An AirTag reports only when some Apple device
 * happens to pass it, so a position read out of Find My this morning may
 * already describe yesterday's yard. These tiers keep the screen from
 * presenting an old sighting as current.
 */
export type CheckFreshness = "none" | "fresh" | "aging" | "stale";

const freshHours = 24;
const agingHours = 72;

export const freshnessLabel: Record<CheckFreshness, string> = {
  none: "Never confirmed",
  fresh: "Confirmed recently",
  aging: "Confirmation aging",
  stale: "Confirmation stale",
};

export const locationSourceLabel: Record<LocationCheckSource, string> = {
  airtag: "AirTag (Find My)",
  driver_report: "Driver report",
  visual: "Seen in person",
};

export function checkFreshness(
  check: AssetLocationCheck | undefined,
  now: number = Date.now(),
): CheckFreshness {
  if (!check) return "none";
  const hours = (now - new Date(check.checkedAt).getTime()) / 3_600_000;
  // A clock skew or a mistyped date reads as "we don't know", never as fresh.
  if (Number.isNaN(hours)) return "none";
  if (hours < freshHours) return "fresh";
  if (hours < agingHours) return "aging";
  return "stale";
}

export function assetCheckKey(
  type: "truck" | "dumpster",
  id: string,
): string {
  return `${type}:${id}`;
}

/**
 * Collapse the check log to the most recent entry per asset. Ties break on the
 * later `id` so the result is stable regardless of the order rows arrive in.
 */
export function latestCheckByAsset(
  checks: AssetLocationCheck[],
): Map<string, AssetLocationCheck> {
  const latest = new Map<string, AssetLocationCheck>();
  for (const check of checks) {
    const key = check.truckId
      ? assetCheckKey("truck", check.truckId)
      : check.dumpsterId
        ? assetCheckKey("dumpster", check.dumpsterId)
        : null;
    if (!key) continue;
    const current = latest.get(key);
    if (!current || isNewer(check, current)) latest.set(key, check);
  }
  return latest;
}

function isNewer(a: AssetLocationCheck, b: AssetLocationCheck): boolean {
  const at = new Date(a.checkedAt).getTime();
  const bt = new Date(b.checkedAt).getTime();
  if (Number.isNaN(at)) return false;
  if (Number.isNaN(bt)) return true;
  return at === bt ? a.id > b.id : at > bt;
}
