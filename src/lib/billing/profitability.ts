/**
 * Job profitability: the arithmetic behind Austin's Operations Dashboard
 * workbook, applied to rows from `profitability_rows()`.
 *
 * Deliberately free of prices and cost assumptions. Those live in the
 * database (the rate card, `cost_defaults`, scale tickets) and are still being
 * confirmed; this module only adds up what a row already carries.
 */

import { pacificDate } from "@/lib/time-clock";

export type CostSource = "estimated" | "actual";

/** One completed job as `profitability_rows()` returns it, in cents. */
export interface ProfitRow {
  jobId: string;
  reference: string;
  completedAt: string;
  invoicedAt: string | null;
  customerId: string;
  customerName: string;
  dumpsterSize: string;
  serviceType: string;
  dumpsterCode: string | null;
  revenueCents: number;
  /** The job's share of what the customer has paid so far, pre-tax. */
  receivedCents: number;
  invoiced: boolean;
  dumpFeeCents: number | null;
  dumpSource: CostSource | null;
  /** Yard to job to dump or yard; fuel is these miles / mpg x diesel. */
  routeMiles: number | null;
  fuelCents: number | null;
  fuelSource: CostSource | null;
  laborCents: number | null;
  laborSource: CostSource | null;
  otherCents: number;
}

/**
 * Which date places a job in a month. Austin counts revenue when it is
 * invoiced (2026-09-30), so that is the default; the completion date stays
 * available for an operational view.
 */
type DateBasis = "completed" | "invoiced";

interface Totals {
  jobs: number;
  revenueCents: number;
  /** Collected so far; the rest of revenue is still owed (Net-30 and the like). */
  receivedCents: number;
  outstandingCents: number;
  expensesCents: number;
  profitCents: number;
  /** Profit over revenue; 0 with no revenue, as the workbook does. */
  margin: number;
  /** Jobs missing a dump, fuel or labor figure, so their profit is overstated. */
  incompleteJobs: number;
  /** Completed jobs with no issued invoice yet. */
  unbilledJobs: number;
}

const expensesOf = (row: ProfitRow) =>
  (row.dumpFeeCents ?? 0) + (row.fuelCents ?? 0) + (row.laborCents ?? 0) + row.otherCents;

const isIncomplete = (row: ProfitRow) =>
  row.dumpFeeCents === null || row.fuelCents === null || row.laborCents === null;

/** Revenue, expenses, profit and margin over any set of jobs. */
export function totals(rows: readonly ProfitRow[]): Totals {
  const revenueCents = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  const receivedCents = rows.reduce((sum, row) => sum + row.receivedCents, 0);
  const expensesCents = rows.reduce((sum, row) => sum + expensesOf(row), 0);
  const profitCents = revenueCents - expensesCents;
  return {
    jobs: rows.length,
    revenueCents,
    receivedCents,
    outstandingCents: revenueCents - receivedCents,
    expensesCents,
    profitCents,
    margin: revenueCents === 0 ? 0 : profitCents / revenueCents,
    incompleteJobs: rows.filter(isIncomplete).length,
    unbilledJobs: rows.filter((row) => !row.invoiced).length,
  };
}

function groupTotals(
  rows: readonly ProfitRow[],
  keyOf: (row: ProfitRow) => string | null,
): Map<string, Totals> {
  const groups = new Map<string, ProfitRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return new Map([...groups].map(([key, members]) => [key, totals(members)]));
}

/**
 * Totals per calendar month (`YYYY-MM`, company time), oldest first. On the
 * invoiced basis a job with no invoice has no month and is left out; the
 * unbilled count on the completed basis is where it shows.
 */
export function byMonth(
  rows: readonly ProfitRow[],
  basis: DateBasis = "invoiced",
): Map<string, Totals> {
  const grouped = groupTotals(rows, (row) => {
    const at = basis === "completed" ? row.completedAt : row.invoicedAt;
    return at ? pacificDate(at).slice(0, 7) : null;
  });
  return new Map([...grouped].sort(([a], [b]) => a.localeCompare(b)));
}

/** Totals per customer, most profitable first. */
export function byCustomer(rows: readonly ProfitRow[]): Map<string, Totals> {
  const grouped = groupTotals(rows, (row) => row.customerName);
  return new Map(
    [...grouped].sort(([, a], [, b]) => b.profitCents - a.profitCents),
  );
}

/** Totals per dumpster size, smallest first. */
export function bySize(rows: readonly ProfitRow[]): Map<string, Totals> {
  const grouped = groupTotals(rows, (row) => row.dumpsterSize);
  return new Map(
    [...grouped].sort(([a], [b]) => Number.parseInt(a) - Number.parseInt(b)),
  );
}
