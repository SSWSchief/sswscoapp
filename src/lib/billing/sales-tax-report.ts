import type { SalesTaxResultRow } from "@/lib/supabase/database.types";
import { pacificDate } from "@/lib/time-clock";

/**
 * The quarterly Nevada sales tax return, from money actually received.
 *
 * SSWS's accountant files each quarter from two figures: total sales and
 * taxable sales. A sale counts in the quarter it was paid (Austin, 2026-10-03),
 * so every row is a receipt, not an invoice. Every line is taxable, so taxable
 * sales equal total sales. Invoices sent before fixed-rate tax, and invoices
 * sent with tax left off (a GC's all-in price, since 2026-10-07), collected
 * nothing, and the return still has to account for them, so that tax is
 * shown separately rather than hidden.
 */
export interface SalesTaxTotals {
  receipts: number;
  receivedCents: number;
  salesCents: number;
  taxableSalesCents: number;
  taxCollectedCents: number;
  taxNotCollectedCents: number;
}

export function salesTaxTotals(rows: SalesTaxResultRow[]): SalesTaxTotals {
  const sum = (pick: (row: SalesTaxResultRow) => number) =>
    rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);
  const salesCents = sum((row) => row.sale_cents);
  return {
    receipts: rows.length,
    receivedCents: sum((row) => row.received_cents),
    salesCents,
    taxableSalesCents: salesCents,
    taxCollectedCents: sum((row) => row.tax_cents),
    taxNotCollectedCents: sum((row) => row.untaxed_cents),
  };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export const salesTaxHeaders = [
  "Date Paid",
  "Invoice",
  "Customer",
  "Invoice Status",
  "Tax Rate",
  "Amount Received",
  "Sales (Before Tax)",
  "Taxable Sales",
  "Sales Tax Collected",
  "Sales Tax Not Collected",
  "Note",
];

/** One row per receipt, then a totals row the accountant can read off. */
export function salesTaxExportRows(rows: SalesTaxResultRow[]): unknown[][] {
  const totals = salesTaxTotals(rows);
  return [
    ...rows.map((row) => [
      pacificDate(row.received_at),
      row.invoice_number,
      row.customer_name,
      row.invoice_status,
      row.tax_rate === null || Number(row.tax_rate) === 0 ? "None charged" : `${Number(row.tax_rate)}%`,
      dollars(Number(row.received_cents)),
      dollars(Number(row.sale_cents)),
      dollars(Number(row.sale_cents)),
      dollars(Number(row.tax_cents)),
      dollars(Number(row.untaxed_cents)),
      Number(row.untaxed_cents) > 0
        ? row.tax_rate === null
          ? "Sent before sales tax was added; no tax was collected."
          : "Sales tax was left off this invoice; no tax was collected."
        : "",
    ]),
    [
      "Total",
      `${totals.receipts} payment${totals.receipts === 1 ? "" : "s"}`,
      "",
      "",
      "",
      dollars(totals.receivedCents),
      dollars(totals.salesCents),
      dollars(totals.taxableSalesCents),
      dollars(totals.taxCollectedCents),
      dollars(totals.taxNotCollectedCents),
      "",
    ],
  ];
}

/** The calendar quarter holding `date` (YYYY-MM-DD), as a date range. */
export function quarterRange(date: string) {
  const [year, month] = date.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3);
  const startMonth = quarter * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    label: `Q${quarter + 1} ${year}`,
    from: `${year}-${pad(startMonth)}-01`,
    to: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

/** The current quarter and the three before it, newest first. */
export function recentQuarters(today: string, count = 4) {
  const quarters = [quarterRange(today)];
  while (quarters.length < count) {
    const [year, month] = quarters[quarters.length - 1].from.split("-").map(Number);
    const previous = month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 3).padStart(2, "0")}-01`;
    quarters.push(quarterRange(previous));
  }
  return quarters;
}

/**
 * Nevada's due date for a quarter's return: the 20th of the month after it
 * closes (Q3 is due October 20, Q4 the following January 20).
 */
export function returnDueDate(quarterEnd: string) {
  const [year, month] = quarterEnd.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-20` : `${year}-${String(month + 1).padStart(2, "0")}-20`;
}
