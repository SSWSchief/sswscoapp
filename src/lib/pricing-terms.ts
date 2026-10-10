import type { DumpsterSize } from "./types";

// Austin, 2026-10-08/09. Rental length depends on the kind of customer and the
// size; the rates themselves are the same for everyone. These live in code
// because they are policy rather than a rate card, and the Pricing & Terms page
// and the invoice both read them from here.
export type CustomerKind = "commercial" | "residential";

const rentalDays: Record<CustomerKind, Partial<Record<DumpsterSize, number>>> = {
  commercial: { "20 Yard": 15, "40 Yard": 30 },
  residential: { "20 Yard": 7, "40 Yard": 14 },
};

/** Starting amount for an extension. The office moves it with how close other pickups are. */
export const extendedRentalWeekCents = 7500;

/** A quote stays good this long before dispatch should re-confirm it. */
export const quoteValidDays = 7;

export const rentalDaysLabel = (kind: CustomerKind, size: DumpsterSize) => {
  const days = rentalDays[kind][size];
  return days === undefined ? null : `${days} days`;
};
