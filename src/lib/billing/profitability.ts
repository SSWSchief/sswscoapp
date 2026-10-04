/**
 * Job profitability: the arithmetic behind Austin's Operations Dashboard
 * workbook, applied to rows from `profitability_rows()`.
 *
 * Deliberately free of prices and cost assumptions. Those live in the
 * database (the rate card, `cost_defaults`, scale tickets) and are still being
 * confirmed; this module only adds up what a row already carries.
 */

import type { ProfitabilityResultRow } from "@/lib/supabase/database.types";
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
export type DateBasis = "completed" | "invoiced";

export interface Totals {
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

const cents = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/** A `profitability_rows()` row in the app's shape. */
export function fromResultRow(row: ProfitabilityResultRow): ProfitRow {
  return {
    jobId: row.job_id,
    reference: row.reference,
    completedAt: row.completed_at,
    invoicedAt: row.invoiced_at,
    customerId: row.customer_id,
    customerName: row.customer_name ?? "",
    dumpsterSize: row.dumpster_size,
    serviceType: row.service_type,
    dumpsterCode: row.dumpster_code,
    revenueCents: Number(row.revenue_cents),
    receivedCents: Number(row.received_cents),
    invoiced: Boolean(row.invoiced),
    dumpFeeCents: cents(row.dump_fee_cents),
    dumpSource: row.dump_source,
    routeMiles: row.route_miles === null ? null : Number(row.route_miles),
    fuelCents: cents(row.fuel_cents),
    fuelSource: row.fuel_source,
    laborCents: cents(row.labor_cents),
    laborSource: row.labor_source,
    otherCents: Number(row.other_cents ?? 0),
  };
}

/**
 * The jobs a period holds on a basis. `profitability_rows()` returns jobs
 * completed or invoiced in the range, so the same fetch serves both views:
 * on the invoiced basis a job belongs to the period its first invoice was
 * issued in; on the completed basis, the period it was finished in.
 */
export function inPeriod(rows: readonly ProfitRow[], from: string, through: string, basis: DateBasis) {
  return rows.filter((row) => {
    const at = basis === "completed" ? row.completedAt : row.invoicedAt;
    if (!at) return false;
    const day = pacificDate(at);
    return day >= from && day <= through;
  });
}

/** Completed in the range but not invoiced yet: revenue still to bill. */
export function unbilledInPeriod(rows: readonly ProfitRow[], from: string, through: string) {
  return rows.filter((row) => {
    const day = pacificDate(row.completedAt);
    return !row.invoiced && day >= from && day <= through;
  });
}

export const profitabilityHeaders = [
  "Job",
  "Completed",
  "Invoiced",
  "Customer",
  "Size",
  "Service",
  "Revenue",
  "Received",
  "Owed",
  "Dump Fee",
  "Dump Fee Source",
  "Route Miles",
  "Fuel",
  "Fuel Source",
  "Labor",
  "Other",
  "Total Expenses",
  "Profit",
  "Margin",
];

const dollars = (value: number | null) => (value === null ? "" : (value / 100).toFixed(2));
const percent = (margin: number) => `${(margin * 100).toFixed(1)}%`;

/** The workbook's job log, one row per job, then the period's totals. */
export function profitabilityExportRows(rows: readonly ProfitRow[]): unknown[][] {
  const sum = totals(rows);
  return [
    ...rows.map((row) => {
      const expenses = expensesOf(row);
      const profit = row.revenueCents - expenses;
      return [
        row.reference,
        pacificDate(row.completedAt),
        row.invoicedAt ? pacificDate(row.invoicedAt) : "Not invoiced",
        row.customerName,
        row.dumpsterSize,
        row.serviceType,
        dollars(row.revenueCents),
        dollars(row.receivedCents),
        dollars(row.revenueCents - row.receivedCents),
        dollars(row.dumpFeeCents),
        row.dumpSource ?? "missing",
        row.routeMiles ?? "",
        dollars(row.fuelCents),
        row.fuelSource ?? "missing",
        dollars(row.laborCents),
        dollars(row.otherCents),
        dollars(expenses),
        dollars(profit),
        row.revenueCents ? percent(profit / row.revenueCents) : "",
      ];
    }),
    [
      "Total",
      `${sum.jobs} job${sum.jobs === 1 ? "" : "s"}`,
      "", "", "", "",
      dollars(sum.revenueCents),
      dollars(sum.receivedCents),
      dollars(sum.outstandingCents),
      "", "", "", "", "", "", "",
      dollars(sum.expensesCents),
      dollars(sum.profitCents),
      percent(sum.margin),
    ],
  ];
}
