/**
 * Nevada sales tax at a fixed rate on every invoice line (8.375%, Clark
 * County), as SSWS's accountant directed on 2026-10-02. Stripe adds the tax
 * when the invoice is sent and its figure is the one stored; this is the
 * office's estimate before sending, and the rule for which rate applies.
 */

/** The percentage an invoice is sent with: none once sales are ruled non-taxable. */
export function salesTaxPercent(taxPolicy: string, rate: number) {
  return taxPolicy === "non_taxable_approved" || !(rate > 0) ? 0 : rate;
}

/**
 * Tax on each line, rounded to the cent, then summed — line by line, as
 * Stripe applies a tax rate.
 */
export function estimateSalesTax(lineAmountsCents: number[], percent: number) {
  const subtotalCents = lineAmountsCents.reduce((sum, amount) => sum + amount, 0);
  const taxCents = lineAmountsCents.reduce(
    (sum, amount) => sum + Math.round((amount * percent) / 100),
    0,
  );
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** "8.375%" — the rate as the office reads it. */
export function formatTaxPercent(percent: number) {
  return `${Number(percent.toFixed(3))}%`;
}
