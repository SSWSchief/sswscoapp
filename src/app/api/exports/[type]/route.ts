import { NextResponse } from "next/server";
import { apiFailure, logRequest, requestId } from "@/lib/api-response";
import { toCsv } from "@/lib/csv";
import { createReportPdf } from "@/lib/report-pdf";
import { createReportXlsx } from "@/lib/report-xlsx";
import { createClient } from "@/lib/supabase/server";
import {
  applyTimeCorrections,
  formatHoursDuration,
  formatPacificTime,
  pacificDate,
  pacificDayEnd,
  pacificDayStart,
  summarizeRange,
} from "@/lib/time-clock";
import { exportQuerySchema } from "@/lib/validation";

const allowed = new Set(["jobs", "invoices", "time", "assets"]);
const punchLabels: Record<string, string> = {
  clock_in: "In",
  break_start: "Break",
  break_end: "Back",
  clock_out: "Out",
};
const maximumRows = 10_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const startedAt = Date.now();
  const requestIdValue = requestId(request);
  const route = "/api/exports/[type]";
  const fail = (code: string, message: string, status: number) => {
    logRequest(status >= 500 ? "error" : "warn", "export_failed", {
      requestId: requestIdValue,
      route,
      method: "GET",
      startedAt,
      status,
      code,
    });
    return apiFailure(code, message, status, requestIdValue);
  };
  const { type } = await params;
  if (!allowed.has(type))
    return fail("unknown_export", "Unknown export type.", 404);
  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return fail("unauthorized", "Sign in required.", 401);
  const permission = await db.rpc("has_permission", {
    permission_key: "reports",
  });
  if (permission.data !== true)
    return fail("forbidden", "Reports permission required.", 403);
  const profile = await db
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.data.user.id)
    .single();
  if (profile.error)
    return fail("profile_missing", "Active employee profile required.", 403);
  const limited = await db.rpc("consume_api_rate_limit", {
    rate_bucket: `export:${type}`,
    maximum_attempts: 20,
    window_seconds: 3600,
  });
  if (limited.error)
    return fail(
      "rate_limit_unavailable",
      "The export could not be safely processed.",
      503,
    );
  if (!limited.data)
    return fail("rate_limited", "Too many exports. Try again later.", 429);
  const url = new URL(request.url);
  const parsedRange = exportQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsedRange.success)
    return fail(
      "invalid_date_range",
      parsedRange.error.issues[0]?.message ?? "The date range is invalid.",
      400,
    );
  const { from, to } = parsedRange.data;
  const format = url.searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "pdf" && format !== "xlsx")
    return fail("invalid_format", "Choose Excel, CSV, or PDF.", 400);
  let headers: string[] = [];
  let rows: unknown[][] = [];
  try {
    if (type === "jobs") {
      const result = await db
        .from("jobs")
        .select("*")
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("scheduled_for")
        .limit(maximumRows + 1);
      if (result.error) throw result.error;
      headers = ["Job", "Date", "Status", "Address", "Service", "Driver ID"];
      rows = (result.data ?? [])
        .filter((job) => {
          const date = pacificDate(job.scheduled_for);
          return date >= from && date <= to;
        })
        .map((job) => [
          job.reference,
          pacificDate(job.scheduled_for),
          job.status,
          job.address,
          job.service_type,
          job.assigned_driver_id ?? "Unassigned",
        ]);
    } else if (type === "invoices") {
      const result = await db
        .from("invoices")
        .select("*")
        .gte("due_date", from)
        .lte("due_date", to)
        .order("due_date")
        .limit(maximumRows + 1);
      if (result.error) throw result.error;
      headers = [
        "Invoice",
        "Customer ID",
        "Billing Mode",
        "Subtotal",
        "Tax",
        "Total",
        "Paid",
        "Remaining",
        "Status",
        "Due Date",
        "PO Number",
        "Notes",
      ];
      rows = (result.data ?? []).map((invoice) => [
        invoice.invoice_number,
        invoice.customer_id,
        invoice.billing_mode,
        (Number(invoice.amount_cents) / 100).toFixed(2),
        (Number(invoice.tax_cents ?? 0) / 100).toFixed(2),
        ((Number(invoice.amount_cents) + Number(invoice.tax_cents ?? 0)) / 100).toFixed(2),
        (Number(invoice.amount_paid_cents) / 100).toFixed(2),
        (Number(invoice.amount_remaining_cents) / 100).toFixed(2),
        invoice.status,
        invoice.due_date,
        invoice.po_number,
        invoice.notes,
      ]);
    } else if (type === "time") {
      // Filtered in the query rather than after it. Taking the oldest
      // `maximumRows` and then narrowing in JS returns steadily less of the
      // requested range as the table grows, and eventually an empty file for
      // any recent week — the exact range payroll asks for.
      const [result, corrections, staff, adjustments] = await Promise.all([
        db
          .from("time_entries")
          .select("*")
          .gte("occurred_at", pacificDayStart(from))
          .lt("occurred_at", pacificDayEnd(to))
          .order("occurred_at")
          .limit(maximumRows + 1),
        db
          .from("time_entry_corrections")
          .select("id,original_entry_id,user_id,replacement_type,replacement_at,request_id")
          .is("superseded_at", null)
          .gte("replacement_at", pacificDayStart(from))
          .lt("replacement_at", pacificDayEnd(to))
          .limit(maximumRows + 1),
        db.from("users").select("id,employee_id,full_name,role"),
        db.from("paid_time_adjustments").select("user_id,work_date,paid_minutes,reason")
          .gte("work_date", from).lte("work_date", to).is("voided_at", null)
          .limit(maximumRows + 1),
      ]);
      if (result.error) throw result.error;
      if (corrections.error) throw corrections.error;
      if (staff.error) throw staff.error;
      if (adjustments.error) throw adjustments.error;
      const byId = new Map(
        (staff.data ?? []).map((person) => [person.id, person]),
      );
      const effectiveEntries = applyTimeCorrections(
        (result.data ?? []).map((entry) => ({
          id: entry.id,
          userId: entry.user_id,
          type: entry.entry_type,
          at: entry.occurred_at,
        })),
        (corrections.data ?? []).map((correction) => ({
          id: correction.id,
          requestId: correction.request_id,
          originalEntryId: correction.original_entry_id,
          userId: correction.user_id,
          replacementType: correction.replacement_type,
          replacementAt: correction.replacement_at,
        })),
      );
      // A raw punch log leaves payroll to calculate breaks and daily totals by
      // hand. Keep the actual timestamps, but group them into the day they
      // belong to and calculate the worked time from the same corrected events
      // displayed in Staff Hours.
      headers = [
        "Employee ID",
        "Employee",
        "Role",
        "Date",
        "Clock In",
        "Clock Out",
        "Break Time",
        "Worked Time",
        "Paid Adjustment",
        "Payable Time",
        "Adjustment Reason",
        "Status",
        "Punches",
      ];
      const paidByUserDay = new Map<string, { minutes: number; reasons: string[] }>();
      for (const adjustment of adjustments.data ?? []) {
        const key = `${adjustment.user_id}:${adjustment.work_date}`;
        const current = paidByUserDay.get(key) ?? { minutes: 0, reasons: [] };
        current.minutes += adjustment.paid_minutes;
        current.reasons.push(adjustment.reason);
        paidByUserDay.set(key, current);
      }
      rows = [...new Set([
        ...effectiveEntries.map((entry) => entry.userId),
        ...(adjustments.data ?? []).map((adjustment) => adjustment.user_id),
      ])]
        .flatMap((userId) => {
          const person = byId.get(userId);
          return summarizeRange(userId, effectiveEntries, from, to).days
            .filter((day) => day.entryCount > 0 || paidByUserDay.has(`${userId}:${day.day}`))
            .map((day) => {
              const paid = paidByUserDay.get(`${userId}:${day.day}`) ?? { minutes: 0, reasons: [] };
              const punches = effectiveEntries
                .filter(
                  (entry) =>
                    entry.userId === userId && pacificDate(entry.at) === day.day,
                )
                .map((entry) => `${punchLabels[entry.type]} ${formatPacificTime(entry.at)}`)
                .join(" · ");
              return [
                person?.employee_id ?? userId,
                person?.full_name ?? "",
                person?.role ?? "",
                day.day,
                day.firstIn ? formatPacificTime(day.firstIn) : "",
                day.lastOut ? formatPacificTime(day.lastOut) : "",
                formatHoursDuration(day.breakSeconds / 3600),
                formatHoursDuration(day.workedSeconds / 3600),
                formatHoursDuration(paid.minutes / 60),
                formatHoursDuration(day.workedSeconds / 3600 + paid.minutes / 60),
                paid.reasons.join(" · "),
                day.open ? "Needs clock-out" : day.entryCount ? "Complete" : "Paid adjustment only",
                punches,
              ];
            });
        })
        .sort((left, right) =>
          `${left[3]}:${left[1]}`.localeCompare(`${right[3]}:${right[1]}`),
        );
    } else {
      const [trucks, dumpsters] = await Promise.all([
        db
          .from("trucks")
          .select("*")
          .is("deleted_at", null)
          .limit(maximumRows + 1),
        db
          .from("dumpsters")
          .select("*")
          .is("deleted_at", null)
          .limit(maximumRows + 1),
      ]);
      if (trucks.error || dumpsters.error)
        throw trucks.error ?? dumpsters.error;
      headers = ["Type", "Asset", "Status", "Location", "AirTag ID"];
      rows = [
        ...(trucks.data ?? []).map((truck) => [
          "Truck",
          truck.number,
          truck.status,
          truck.last_known_location ?? "",
          truck.air_tag_id ?? "",
        ]),
        ...(dumpsters.data ?? []).map((dumpster) => [
          "Dumpster",
          dumpster.code,
          dumpster.status,
          dumpster.current_location,
          dumpster.air_tag_id ?? "",
        ]),
      ];
    }
  } catch {
    return fail("export_query_failed", "Export data could not be loaded.", 500);
  }
  if (rows.length > maximumRows)
    return fail(
      "export_too_large",
      "Narrow the date range to fewer than 10,000 rows.",
      413,
    );
  let pdf: Uint8Array<ArrayBuffer> | null = null;
  if (format === "pdf") {
    try {
      pdf = new Uint8Array(await createReportPdf(type, from, to, headers, rows));
    } catch {
      return fail("pdf_generation_failed", "PDF report could not be generated.", 500);
    }
  }
  const audit = await db.from("export_audit").insert({
    export_type: type,
    filters: { from, to, format },
    row_count: rows.length,
    requested_by_id: profile.data.id,
  });
  if (audit.error)
    return fail(
      "export_audit_failed",
      "The export was not generated because its audit record could not be saved.",
      500,
    );
  const csv = toCsv(headers, rows);
  logRequest("info", "export_complete", {
    requestId: requestIdValue,
    route,
    method: "GET",
    startedAt,
    status: 200,
  });
  if (format === "xlsx") return new NextResponse(new Uint8Array(createReportXlsx(`${type} ${from} to ${to}`, headers, rows)), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${type}-${from}-${to}.xlsx"`,
      "cache-control": "no-store",
      "x-request-id": requestIdValue,
    },
  });
  if (pdf) return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${type}-${from}-${to}.pdf"`,
      "cache-control": "no-store",
      "x-request-id": requestIdValue,
    },
  });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}-${from}-${to}.csv"`,
      "cache-control": "no-store",
      "x-request-id": requestIdValue,
    },
  });
}
