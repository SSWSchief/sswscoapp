import type {
  Dumpster,
  InvoiceLineCategory,
  PriceListItem,
} from "@/lib/types";

/**
 * What a line-item category is called on screen.
 *
 * The stored values are the database enum and never change; these are the
 * words the office and the customer read. "surcharge" prints as "Fuel
 * surcharge" because that is the only surcharge SSWSCO bills — the rate sheet
 * carries one, the 5% fuel/environmental line — and dispatch asked for it to
 * say so rather than leaving the reader to guess which surcharge it is.
 */
export const invoiceLineCategoryLabel: Record<InvoiceLineCategory, string> = {
  service: "Service",
  rental: "Rental",
  tonnage: "Tonnage",
  fee: "Fee",
  surcharge: "Fuel surcharge",
  adjustment: "Adjustment",
};

/** The description offered when a category is picked before anything is typed. */
export const invoiceLineCategoryDefaultDescription: Partial<
  Record<InvoiceLineCategory, string>
> = {
  surcharge: "Fuel surcharge",
};

/**
 * Categories whose amount says nothing about what was charged, so the
 * description has to. A customer reading "Fee $250" has no way to tell an
 * overload from a prohibited-material charge; they can read "Rental" or
 * "Tonnage" against the container and the ticket.
 */
const NEEDS_CUSTOMER_FACING_DETAIL: ReadonlySet<InvoiceLineCategory> =
  new Set<InvoiceLineCategory>(["fee", "adjustment"]);

/** One pickable description, with the rate behind it when there is one. */
export interface InvoiceLineSuggestion {
  description: string;
  /** The rate-card amount, or null when only the wording is being offered. */
  amountCents: number | null;
  category: InvoiceLineCategory;
}

/**
 * Charges that are worded the same every time but priced case by case.
 *
 * They carry no amount deliberately: the rate sheet's figures live in the
 * price list, which the office maintains, and inventing them here would put a
 * second, silently diverging rate card in the code.
 */
const STANDING_CHARGES: InvoiceLineSuggestion[] = [
  { description: "Fuel surcharge", amountCents: null, category: "surcharge" },
  {
    description: "Extended rental — additional days beyond the included period",
    amountCents: null,
    category: "rental",
  },
  {
    description: "Additional tonnage over the included weight",
    amountCents: null,
    category: "tonnage",
  },
  {
    description: "Overweight / overloaded container",
    amountCents: null,
    category: "fee",
  },
  { description: "Dry run — no service performed", amountCents: null, category: "fee" },
  {
    description: "Prohibited material in the container",
    amountCents: null,
    category: "fee",
  },
];

const separator = " · ";

/**
 * Every description invoicing can offer, in the order it should be read.
 *
 * Priced service lines come first, then the same services against a specific
 * container so a line can name the asset that did the work, then the standing
 * charges. Containers come straight from the dumpster records, so an asset
 * added on the Dumpsters page is available to invoicing with no second step —
 * which is what dispatch asked for.
 */
export function invoiceLineSuggestions({
  priceList,
  dumpsters,
}: {
  priceList: readonly PriceListItem[];
  dumpsters: readonly Dumpster[];
}): InvoiceLineSuggestion[] {
  const rates = [...priceList].sort(
    (left, right) =>
      left.serviceType.localeCompare(right.serviceType) ||
      left.dumpsterSize.localeCompare(right.dumpsterSize),
  );
  const services = rates.map<InvoiceLineSuggestion>((rate) => ({
    description: [rate.serviceType, rate.dumpsterSize].join(separator),
    amountCents: rate.priceCents,
    category: "service",
  }));
  const containers = [...dumpsters]
    .sort((left, right) => left.code.localeCompare(right.code))
    .flatMap<InvoiceLineSuggestion>((dumpster) =>
      rates
        .filter((rate) => rate.dumpsterSize === dumpster.size)
        .map((rate) => ({
          description: [rate.serviceType, dumpster.size, dumpster.code].join(
            separator,
          ),
          amountCents: rate.priceCents,
          category: "service",
        })),
    );
  return dedupe([...services, ...containers, ...STANDING_CHARGES]);
}

function dedupe(
  suggestions: InvoiceLineSuggestion[],
): InvoiceLineSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.description.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The suggestion a typed description exactly matches, if any. */
export function matchSuggestion(
  suggestions: readonly InvoiceLineSuggestion[],
  description: string,
): InvoiceLineSuggestion | undefined {
  const typed = description.trim().toLowerCase();
  if (!typed) return undefined;
  return suggestions.find(
    (suggestion) => suggestion.description.toLowerCase() === typed,
  );
}

/**
 * Why this line cannot be sent to a customer as written, or null when it can.
 *
 * Every line needs a description; a fee or an adjustment additionally needs one
 * that says more than its own category, because that word is all the customer
 * would otherwise have to go on.
 */
export function lineDescriptionProblem(
  category: InvoiceLineCategory,
  description: string,
): string | null {
  const typed = description.trim();
  if (!typed) return "Every line item needs a description.";
  if (!NEEDS_CUSTOMER_FACING_DETAIL.has(category)) return null;
  const bare = new Set([category, invoiceLineCategoryLabel[category]].map((value) => value.toLowerCase()));
  if (bare.has(typed.toLowerCase()) || typed.length < 4)
    return `Describe the ${invoiceLineCategoryLabel[category].toLowerCase()} so the customer knows what it is for.`;
  return null;
}
