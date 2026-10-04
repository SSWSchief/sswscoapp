import { describe, expect, it } from "vitest";
import { byCustomer, byMonth, bySize, fromResultRow, inPeriod, profitabilityExportRows, totals, unbilledInPeriod, type ProfitRow } from "./profitability";

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
  receivedCents: 0,
  invoiced: true,
  dumpFeeCents: 0,
  dumpSource: "estimated",
  routeMiles: null,
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

  it("splits revenue into received and still owed", () => {
    const sum = totals([
      row({ revenueCents: 62500, receivedCents: 31250 }),
      row({ revenueCents: 40000, receivedCents: 40000 }),
    ]);
    expect(sum).toMatchObject({ revenueCents: 102500, receivedCents: 71250, outstandingCents: 31250 });
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

  it("groups by invoice date by default, leaving unbilled jobs out", () => {
    const months = byMonth([late, unbilled, ...penta]);
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

describe("periods", () => {
  const september = row({ jobId: "sep", completedAt: "2026-09-29T18:00:00Z", invoicedAt: "2026-10-01T06:30:00Z" });
  const unbilled = row({ jobId: "open", completedAt: "2026-10-02T18:00:00Z", invoicedAt: null, invoiced: false });

  it("places a job by its invoice date or its completion date, in Las Vegas time", () => {
    // Invoiced at 11:30 PM on Sept 30 in Las Vegas.
    expect(inPeriod([september], "2026-09-01", "2026-09-30", "invoiced")).toHaveLength(1);
    expect(inPeriod([september], "2026-10-01", "2026-10-31", "invoiced")).toHaveLength(0);
    expect(inPeriod([september, unbilled], "2026-10-01", "2026-10-31", "completed").map((r) => r.jobId)).toEqual(["open"]);
  });

  it("finds completed jobs still waiting on an invoice", () => {
    expect(unbilledInPeriod([september, unbilled], "2026-10-01", "2026-10-31").map((r) => r.jobId)).toEqual(["open"]);
    expect(inPeriod([unbilled], "2026-10-01", "2026-10-31", "invoiced")).toHaveLength(0);
  });
});

describe("database rows", () => {
  it("reads numbers and missing costs as the report needs them", () => {
    const mapped = fromResultRow({
      job_id: "j", reference: "#1062", completed_at: "2026-09-17T15:00:00Z", invoiced_at: null,
      customer_id: "c", customer_name: "John Evans", dumpster_size: "20 Yard", service_type: "Delivery",
      dumpster_code: "120", revenue_cents: 40000, received_cents: 40000, invoiced: true,
      dump_fee_cents: null, dump_source: null, route_miles: 26 as unknown as number, fuel_cents: 1836,
      fuel_source: "estimated", labor_cents: 8800, labor_source: "estimated", other_cents: 0,
    });
    expect(mapped).toMatchObject({ reference: "#1062", dumpFeeCents: null, routeMiles: 26, fuelCents: 1836, laborCents: 8800 });
  });
});

describe("export", () => {
  it("writes the job log with a totals row", () => {
    const rows = profitabilityExportRows(penta);
    expect(rows).toHaveLength(4);
    expect(rows[0].slice(0, 7)).toEqual(["#1", "2026-09-15", "2026-09-16", "Penta", "40 Yard", "Pick-Up", "825.00"]);
    expect(rows[0].slice(-3)).toEqual(["565.00", "260.00", "31.5%"]);
    expect(rows.at(-1)?.slice(-3)).toEqual(["1494.00", "681.00", "31.3%"]);
  });

  it("flags a missing cost rather than printing zero", () => {
    const [line] = profitabilityExportRows([row({ dumpFeeCents: null, dumpSource: null, invoicedAt: null })]);
    expect(line[2]).toBe("Not invoiced");
    expect(line[9]).toBe("");
    expect(line[10]).toBe("missing");
  });
});
