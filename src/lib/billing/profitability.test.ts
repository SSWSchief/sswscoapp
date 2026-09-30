import { describe, expect, it } from "vitest";
import { byCustomer, byMonth, bySize, totals, type ProfitRow } from "./profitability";

const row = (overrides: Partial<ProfitRow>): ProfitRow => ({
  jobId: "job",
  reference: "#1",
  completedAt: "2026-09-15T18:00:00Z",
  invoicedAt: "2026-09-16T17:00:00Z",
  customerId: "penta",
  customerName: "Penta",
  dumpsterSize: "20 Yard",
  serviceType: "Pick-Up",
  dumpsterCode: "120",
  revenueCents: 0,
  invoiced: true,
  dumpFeeCents: 0,
  dumpSource: "estimated",
  fuelCents: 0,
  fuelSource: "estimated",
  laborCents: 0,
  laborSource: "estimated",
  otherCents: 0,
  ...overrides,
});

// The three rows of Austin's workbook, Container Log rows 7-9.
const penta = [
  row({ jobId: "140", dumpsterSize: "40 Yard", revenueCents: 82500, dumpFeeCents: 40200, fuelCents: 7500, laborCents: 8800 }),
  row({ jobId: "130", dumpsterSize: "30 Yard", revenueCents: 72500, dumpFeeCents: 33500, fuelCents: 7500, laborCents: 8800 }),
  row({ jobId: "120", dumpsterSize: "20 Yard", revenueCents: 62500, dumpFeeCents: 26800, fuelCents: 7500, laborCents: 8800 }),
];

describe("totals", () => {
  it("matches the workbook's dashboard for the Penta rows", () => {
    const sum = totals(penta);
    expect(sum).toMatchObject({
      jobs: 3,
      revenueCents: 217500,
      expensesCents: 149400,
      profitCents: 68100,
      incompleteJobs: 0,
      unbilledJobs: 0,
    });
    expect(sum.margin).toBeCloseTo(0.3131034483, 9);
  });

  it("reports no margin rather than dividing by zero", () => {
    expect(totals([row({ revenueCents: 0, fuelCents: 7500 })]).margin).toBe(0);
    expect(totals([]).margin).toBe(0);
  });

  it("counts a missing cost as zero but flags the job as incomplete", () => {
    const sum = totals([row({ revenueCents: 50000, fuelCents: null, laborCents: 8800 })]);
    expect(sum.expensesCents).toBe(8800);
    expect(sum.incompleteJobs).toBe(1);
  });

  it("includes other expenses", () => {
    expect(totals([row({ revenueCents: 10000, otherCents: 2500 })]).profitCents).toBe(7500);
  });

  it("counts unbilled jobs", () => {
    expect(totals([row({ invoiced: false }), row({})]).unbilledJobs).toBe(1);
  });
});

describe("byMonth", () => {
  const late = row({
    jobId: "late",
    revenueCents: 40000,
    // 9:30 pm on Sep 30 in Las Vegas is already Oct 1 in UTC.
    completedAt: "2026-10-01T04:30:00Z",
    invoicedAt: "2026-10-02T17:00:00Z",
  });
  const unbilled = row({ jobId: "unbilled", revenueCents: 0, invoiced: false, invoicedAt: null });

  it("groups by the company's calendar month, oldest first", () => {
    const months = byMonth([late, ...penta], "completed");
    expect([...months.keys()]).toEqual(["2026-09"]);
    expect(months.get("2026-09")?.revenueCents).toBe(257500);
  });

  it("can group by invoice date instead, leaving unbilled jobs out", () => {
    const months = byMonth([late, unbilled, ...penta], "invoiced");
    expect([...months.keys()]).toEqual(["2026-09", "2026-10"]);
    expect(months.get("2026-10")?.jobs).toBe(1);
    expect([...months.values()].reduce((n, t) => n + t.jobs, 0)).toBe(4);
  });
});

describe("byCustomer and bySize", () => {
  it("lists customers without a hand-kept list, most profitable first", () => {
    const customers = byCustomer([
      ...penta,
      row({ customerId: "evans", customerName: "John Evans", revenueCents: 100000 }),
    ]);
    expect([...customers.keys()]).toEqual(["John Evans", "Penta"]);
    expect(customers.get("Penta")?.profitCents).toBe(68100);
  });

  it("orders sizes by yardage, not alphabetically", () => {
    const sizes = bySize([...penta, row({ dumpsterSize: "10 Yard" })]);
    expect([...sizes.keys()]).toEqual(["10 Yard", "20 Yard", "30 Yard", "40 Yard"]);
    expect(sizes.get("40 Yard")?.profitCents).toBe(26000);
  });
});
