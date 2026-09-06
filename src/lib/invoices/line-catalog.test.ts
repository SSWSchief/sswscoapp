import { describe, expect, it } from "vitest";
import {
  invoiceLineCategoryLabel,
  invoiceLineSuggestions,
  lineDescriptionProblem,
  matchSuggestion,
} from "./line-catalog";
import type { Dumpster, PriceListItem } from "@/lib/types";

const rate = (
  serviceType: PriceListItem["serviceType"],
  dumpsterSize: PriceListItem["dumpsterSize"],
  priceCents: number,
): PriceListItem => ({
  id: `${serviceType}-${dumpsterSize}`,
  serviceType,
  dumpsterSize,
  priceCents,
  notes: "",
  updatedAt: "2026-09-06T00:00:00.000Z",
});

const dumpster = (code: string, size: Dumpster["size"]): Dumpster => ({
  id: code,
  code,
  size,
  status: "in_yard",
  type: "Roll-off",
  currentCustomerId: null,
  currentLocation: "",
  currentJobId: null,
  airTagId: null,
  notes: "",
});

const priceList = [
  rate("Delivery", "20 Yard", 40000),
  rate("Pick-Up", "40 Yard", 52500),
];
const dumpsters = [dumpster("D-102", "20 Yard"), dumpster("D-410", "40 Yard")];

describe("invoiceLineSuggestions", () => {
  it("offers each rate-card service with its price", () => {
    expect(invoiceLineSuggestions({ priceList, dumpsters })).toContainEqual({
      description: "Delivery · 20 Yard",
      amountCents: 40000,
      category: "service",
    });
  });

  it("offers the same service against a container, so a line can name the asset", () => {
    expect(invoiceLineSuggestions({ priceList, dumpsters })).toContainEqual({
      description: "Pick-Up · 40 Yard · D-410",
      amountCents: 52500,
      category: "service",
    });
  });

  it("prices a container line only from the rates for that container's size", () => {
    const descriptions = invoiceLineSuggestions({ priceList, dumpsters }).map(
      (suggestion) => suggestion.description,
    );
    // D-102 is a 20 yard can; the only 40 yard rate must not attach to it.
    expect(descriptions).not.toContain("Pick-Up · 40 Yard · D-102");
    expect(descriptions).not.toContain("Pick-Up · 20 Yard · D-102");
  });

  it("carries an asset added after the price list without any further step", () => {
    const added = [...dumpsters, dumpster("D-777", "20 Yard")];
    expect(
      invoiceLineSuggestions({ priceList, dumpsters: added }).map(
        (suggestion) => suggestion.description,
      ),
    ).toContain("Delivery · 20 Yard · D-777");
  });

  it("offers the standing charges without inventing a price for them", () => {
    const fuel = invoiceLineSuggestions({ priceList, dumpsters }).find(
      (suggestion) => suggestion.description === "Fuel surcharge",
    );
    expect(fuel).toEqual({
      description: "Fuel surcharge",
      amountCents: null,
      category: "surcharge",
    });
  });

  it("lists nothing twice, however the fleet and rates overlap", () => {
    const descriptions = invoiceLineSuggestions({
      priceList: [...priceList, rate("Delivery", "20 Yard", 40000)],
      dumpsters: [...dumpsters, dumpster("D-102", "20 Yard")],
    }).map((suggestion) => suggestion.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("holds up with no rates and no fleet loaded yet", () => {
    expect(
      invoiceLineSuggestions({ priceList: [], dumpsters: [] }).every(
        (suggestion) => suggestion.amountCents === null,
      ),
    ).toBe(true);
  });
});

describe("matchSuggestion", () => {
  const suggestions = invoiceLineSuggestions({ priceList, dumpsters });

  it("matches a picked description regardless of case and padding", () => {
    expect(matchSuggestion(suggestions, "  delivery · 20 yard  ")?.amountCents).toBe(
      40000,
    );
  });

  it("matches nothing while a description is still being typed", () => {
    expect(matchSuggestion(suggestions, "Delivery ·")).toBeUndefined();
    expect(matchSuggestion(suggestions, "   ")).toBeUndefined();
  });
});

describe("lineDescriptionProblem", () => {
  it("requires a description on every line", () => {
    expect(lineDescriptionProblem("service", "  ")).toMatch(/needs a description/i);
  });

  it("accepts a priced service line as written", () => {
    expect(lineDescriptionProblem("service", "Delivery · 20 Yard")).toBeNull();
  });

  it("refuses a fee that only repeats its own category", () => {
    expect(lineDescriptionProblem("fee", "Fee")).toMatch(/so the customer knows/i);
    expect(lineDescriptionProblem("adjustment", "adjustment")).toMatch(
      /so the customer knows/i,
    );
  });

  it("accepts a fee that says what it is for", () => {
    expect(lineDescriptionProblem("fee", "Prohibited material in the container")).toBeNull();
  });

  it("leaves the fuel surcharge alone, which already names itself", () => {
    expect(
      lineDescriptionProblem("surcharge", invoiceLineCategoryLabel.surcharge),
    ).toBeNull();
  });
});
