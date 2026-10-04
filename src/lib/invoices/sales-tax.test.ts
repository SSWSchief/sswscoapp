import { describe, expect, it } from "vitest";
import { estimateSalesTax, formatTaxPercent, salesTaxPercent } from "./sales-tax";

describe("fixed-rate sales tax", () => {
  it("taxes every line at the company rate unless sales are ruled non-taxable", () => {
    expect(salesTaxPercent("fixed_rate_approved", 8.375)).toBe(8.375);
    expect(salesTaxPercent("pending", 8.375)).toBe(8.375);
    expect(salesTaxPercent("non_taxable_approved", 8.375)).toBe(0);
    expect(salesTaxPercent("fixed_rate_approved", 0)).toBe(0);
  });

  it("rounds each line's tax to the cent before adding, as Stripe does", () => {
    // $400 rental + 5% fuel fee ($20) at 8.375%: 33.50 + 1.675 -> 1.68.
    expect(estimateSalesTax([40000, 2000], 8.375)).toEqual({ subtotalCents: 42000, taxCents: 3518, totalCents: 45518 });
    expect(estimateSalesTax([40000], 0)).toEqual({ subtotalCents: 40000, taxCents: 0, totalCents: 40000 });
  });

  it("prints the rate without trailing zeros", () => {
    expect(formatTaxPercent(8.375)).toBe("8.375%");
    expect(formatTaxPercent(8)).toBe("8%");
  });
});
