import { describe, expect, it } from "vitest";
import type { SalesTaxResultRow } from "@/lib/supabase/database.types";
import { quarterRange, recentQuarters, returnDueDate, salesTaxExportRows, salesTaxTotals } from "./sales-tax-report";

const receipt = (overrides: Partial<SalesTaxResultRow> = {}): SalesTaxResultRow => ({
  payment_id: "p1",
  received_at: "2026-10-12T18:00:00Z",
  invoice_id: "i1",
  invoice_number: "INV-000014",
  customer_name: "Penta Building Group",
  billing_mode: "per_job",
  invoice_status: "paid",
  tax_rate: 8.375,
  received_cents: 43350,
  sale_cents: 40000,
  tax_cents: 3350,
  untaxed_cents: 0,
  ...overrides,
});

describe("sales tax totals", () => {
  it("counts every sale as taxable and keeps uncollected tax apart", () => {
    const totals = salesTaxTotals([
      receipt(),
      // The first real job: sent before tax, so none was collected.
      receipt({ payment_id: "p2", invoice_number: "INV-000013", tax_rate: null, received_cents: 40000, sale_cents: 40000, tax_cents: 0, untaxed_cents: 3350 }),
    ]);
    expect(totals).toEqual({
      receipts: 2,
      receivedCents: 83350,
      salesCents: 80000,
      taxableSalesCents: 80000,
      taxCollectedCents: 3350,
      taxNotCollectedCents: 3350,
    });
  });

  it("is all zeros for a quarter with no payments, which still needs a return", () => {
    expect(salesTaxTotals([])).toMatchObject({ receipts: 0, salesCents: 0, taxCollectedCents: 0 });
  });
});

describe("sales tax export", () => {
  it("writes a row per payment in Pacific dates and a totals row", () => {
    const rows = salesTaxExportRows([
      receipt({ received_at: "2026-10-01T05:30:00Z" }),
      receipt({ payment_id: "p2", tax_rate: null, tax_cents: 0, sale_cents: 40000, received_cents: 40000, untaxed_cents: 3350 }),
    ]);
    // 05:30 UTC on Oct 1 is still Sept 30 in Las Vegas: it belongs to Q3.
    expect(rows[0]).toEqual(["2026-09-30", "INV-000014", "Penta Building Group", "paid", "8.375%", "433.50", "400.00", "400.00", "33.50", "0.00", ""]);
    expect(rows[1][4]).toBe("None charged");
    expect(rows[1][10]).toMatch(/no tax was collected/);
    expect(rows.at(-1)).toEqual(["Total", "2 payments", "", "", "", "833.50", "800.00", "800.00", "33.50", "33.50", ""]);
  });

  it("says which untaxed invoices had tax left off rather than predating it", () => {
    const rows = salesTaxExportRows([
      receipt({ tax_rate: null, tax_cents: 0, sale_cents: 40000, received_cents: 40000, untaxed_cents: 3350 }),
      receipt({ payment_id: "p2", tax_rate: 0, tax_cents: 0, sale_cents: 52500, received_cents: 52500, untaxed_cents: 4397 }),
    ]);
    expect(rows[0][10]).toMatch(/^Sent before sales tax was added/);
    expect(rows[1][4]).toBe("None charged");
    expect(rows[1][10]).toMatch(/^Sales tax was left off this invoice/);
  });
});

describe("quarters", () => {
  it("knows each quarter's dates and the return's due date", () => {
    expect(quarterRange("2026-09-30")).toEqual({ label: "Q3 2026", from: "2026-07-01", to: "2026-09-30" });
    expect(quarterRange("2026-02-11")).toEqual({ label: "Q1 2026", from: "2026-01-01", to: "2026-03-31" });
    expect(returnDueDate("2026-09-30")).toBe("2026-10-20");
    expect(returnDueDate("2026-12-31")).toBe("2027-01-20");
  });
  it("lists the current quarter and the ones before it, across a year end", () => {
    expect(recentQuarters("2027-01-05").map((quarter) => quarter.label)).toEqual(["Q1 2027", "Q4 2026", "Q3 2026", "Q2 2026"]);
  });
});
