/**
 * The two quantities the rate sheet bills against: how much a load weighed,
 * and how long a container stood on site.
 *
 * Deliberately free of prices. Allowances and overage rates belong to the rate
 * card, which is a separate concern and still unconfirmed; these functions only
 * turn stored facts into the units the sheet is written in.
 */

import type { ServiceType } from "@/lib/types";

const POUNDS_PER_TON = 2000;

/**
 * Services that take a loaded container to a disposal site, and so come back
 * with a scale ticket.
 *
 * Delivery and Relocation move an empty or already-placed can and weigh
 * nothing; Dry Run and Service Call never reach the landfill at all.
 */
const HAUL_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>([
  "Pick-Up",
  "Dump & Return",
  "Swap / Exchange",
]);

/** Whether a job of this service type should produce a disposal ticket. */
export function producesDisposalTicket(service: ServiceType): boolean {
  return HAUL_SERVICES.has(service);
}

/**
 * Net tons for a ticket, rounded to two decimals for display and comparison.
 *
 * Pounds are what the scale prints and what the database stores, so this is a
 * presentation and arithmetic helper, never a substitute for the stored value.
 */
export function netTons(pounds: number): number {
  if (!Number.isFinite(pounds) || pounds <= 0) return 0;
  return Math.round((pounds / POUNDS_PER_TON) * 100) / 100;
}

/** The calendar date in a given zone, as YYYY-MM-DD. */
function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Whole days a container stood on site, counted in calendar days in the
 * company's own time zone rather than in elapsed hours -- a can dropped at
 * 6pm Monday and pulled at 8am Tuesday is two days on the sheet, not one.
 *
 * ASSUMPTION (revisit): the delivery day counts as day one, so a same-day
 * delivery and pick-up is one day. That is the ordinary convention but has
 * not been confirmed. See docs/billing-assumptions.md.
 *
 * An open placement -- `retrievedAt` null -- is measured against `asOf`, so
 * dispatch can see what a rental has accrued before it comes back.
 */
export function daysOnSite(
  deliveredAt: string,
  retrievedAt: string | null,
  timeZone = "America/Los_Angeles",
  asOf: string = new Date().toISOString(),
): number {
  const start = localDate(deliveredAt, timeZone);
  const end = localDate(retrievedAt ?? asOf, timeZone);
  const spanMs = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(spanMs) || spanMs < 0) return 0;
  return Math.round(spanMs / 86_400_000) + 1;
}
