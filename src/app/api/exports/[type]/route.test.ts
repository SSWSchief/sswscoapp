import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { strFromU8, unzipSync } from "fflate";
import { fakeAdminClient, type Row } from "@/test/supabase-fake";

const state = { tables: {} as Record<string, Row[]>, permissions: new Set(["reports", "invoices", "profitability"]), salesTaxRows: [] as Row[], profitRows: [] as Row[] };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const fake = fakeAdminClient(state.tables);
    return {
      ...fake.client,
      auth: { getUser: async () => ({ data: { user: { id: "auth-admin" } } }) },
      rpc: async (name: string, args: { permission_key?: string } = {}) => ({
        data: name === "sales_tax_rows"
          ? state.salesTaxRows
          : name === "profitability_rows"
            ? state.profitRows
          : name === "has_permission"
            ? state.permissions.has(args.permission_key ?? "")
            : name === "consume_api_rate_limit",
        error: null,
      }),
    };
  },
}));

const { GET } = await import("./route");
const get = (type: string, format = "csv") => GET(
  new Request(`https://example.test/api/exports/${type}?from=2026-09-01&to=2026-09-30&format=${format}`),
  { params: Promise.resolve({ type }) },
);

beforeEach(() => {
  state.permissions = new Set(["reports", "invoices", "profitability"]);
  state.profitRows = [
    { job_id: "j1", reference: "#1062", completed_at: "2026-09-17T15:00:00Z", invoiced_at: "2026-09-18T15:00:00Z", customer_id: "c", customer_name: "John Evans", dumpster_size: "20 Yard", service_type: "Delivery", dumpster_code: "120", revenue_cents: 40000, received_cents: 40000, invoiced: true, dump_fee_cents: 26840, dump_source: "actual", route_miles: 26, fuel_cents: 1836, fuel_source: "estimated", labor_cents: 8800, labor_source: "estimated", other_cents: 0 },
  ];
  state.salesTaxRows = [
    { payment_id: "p1", received_at: "2026-09-29T16:02:34Z", invoice_id: "i12", invoice_number: "INV-000012", customer_name: "Owner test", billing_mode: "one_off", invoice_status: "paid", tax_rate: null, received_cents: 100, sale_cents: 100, tax_cents: 0, untaxed_cents: 8 },
  ];
  state.tables = {
    users: [
      { id: "admin", auth_user_id: "auth-admin", employee_id: "001", full_name: "Admin", role: "management" },
      { id: "driver", auth_user_id: "auth-driver", employee_id: "006", full_name: "Matthew", role: "driver" },
    ],
    jobs: [{ id: "job", reference: "#100", scheduled_for: "2026-09-24T16:00:00Z", status: "complete", address: "Reno", service_type: "Delivery", assigned_driver_id: "driver", deleted_at: null, archived_at: null }],
    invoices: [{ invoice_number: "INV-1", customer_id: "customer", billing_mode: "per_job", amount_cents: 40000, tax_cents: 0, amount_paid_cents: 0, amount_remaining_cents: 40000, status: "open", due_date: "2026-09-30", po_number: "", notes: "" }],
    trucks: [{ number: "T1", status: "in_use", last_known_location: "Reno", air_tag_id: null, deleted_at: null }],
    dumpsters: [{ code: "D1", status: "out", current_location: "Reno", air_tag_id: "AT1", deleted_at: null }],
    time_entries: [
      { id: "in", user_id: "driver", entry_type: "clock_in", occurred_at: "2026-09-01T15:44:32.025273+00:00" },
      { id: "out", user_id: "driver", entry_type: "clock_out", occurred_at: "2026-09-01T18:46:53.262801+00:00" },
    ],
    time_entry_corrections: [],
    paid_time_adjustments: [{ user_id: "driver", work_date: "2026-09-24", paid_minutes: 240, reason: "Minimum and meeting", voided_at: null }],
    export_audit: [],
  };
});

describe("report downloads", () => {
  it.each(["jobs", "invoices", "time", "assets", "sales-tax", "profitability"])("returns a real %s PDF attachment", async (type) => {
    const response = await get(type, "pdf");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(`${type}-2026-09-01-2026-09-30.pdf`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it("keeps CSV as CSV and includes paid-only days", async () => {
    const response = await get("time");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(".csv");
    const csv = await response.text();
    expect(csv).toContain("Paid Adjustment,Payable Time");
    expect(csv).toContain("Minimum and meeting");
    expect(csv).toContain("Paid adjustment only");
  });

  it("prints punch times in Pacific time, not raw UTC timestamps", async () => {
    const csv = await (await get("time")).text();
    expect(csv).not.toContain("2026-09-01T15:44");
    expect(csv).toContain("2026-09-01,8:44 AM,11:46 AM");
    expect(csv).toContain("In 8:44 AM · Out 11:46 AM");
  });

  it.each(["jobs", "invoices", "time", "assets"])("returns a real %s Excel workbook", async (type) => {
    const response = await get(type, "xlsx");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toContain(`${type}-2026-09-01-2026-09-30.xlsx`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]));
    if (type === "time") {
      const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
      expect(sheet).toContain(">006<");
      expect(sheet).toContain("Minimum and meeting");
    }
    if (type === "invoices") expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain('s="2"><v>400.00</v>');
  });

  it("writes the sales tax return with its totals row", async () => {
    const text = await (await get("sales-tax")).text();
    expect(text).toContain("Date Paid,Invoice,Customer");
    expect(text).toContain("2026-09-29,INV-000012,Owner test,paid,None charged,1.00,1.00,1.00,0.00,0.08");
    expect(text).toContain("Total,1 payment,,,,1.00,1.00,1.00,0.00,0.08");
  });

  it("writes the profitability job log for management", async () => {
    const text = await (await get("profitability")).text();
    expect(text).toContain("#1062,2026-09-17,2026-09-18,John Evans,20 Yard,Delivery,400.00,400.00,0.00,268.40,actual,26,18.36,estimated,88.00,0.00,374.76,25.24,6.3%");
    expect(text).toContain("Total,1 job");
  });

  it("keeps profitability from staff without that permission", async () => {
    state.permissions = new Set(["reports", "invoices"]);
    expect((await get("profitability")).status).toBe(403);
  });

  it("keeps the sales tax return from staff without invoices access", async () => {
    state.permissions = new Set(["reports"]);
    const response = await get("sales-tax");
    expect(response.status).toBe(403);
    expect(state.tables.export_audit).toHaveLength(0);
  });

  it("rejects an unknown format", async () => {
    expect((await get("jobs", "html")).status).toBe(400);
  });
});
