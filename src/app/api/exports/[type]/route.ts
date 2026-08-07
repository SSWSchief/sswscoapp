import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { pacificDate } from "@/lib/time-clock";

const allowed = new Set(["jobs", "invoices", "time", "assets"]);

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!allowed.has(type)) return NextResponse.json({ error: { code: "unknown_export", message: "Unknown export type" } }, { status: 404 });
  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in required" } }, { status: 401 });
  const permission = await db.rpc("has_permission", { permission_key: "reports" });
  if (permission.data !== true) return NextResponse.json({ error: { code: "forbidden", message: "Reports permission required" } }, { status: 403 });
  const profile = await db.from("users").select("id").eq("auth_user_id", auth.data.user.id).single();
  if (profile.error) return NextResponse.json({ error: { code: "profile_missing", message: "Active employee profile required" } }, { status: 403 });
  const url = new URL(request.url); const from = url.searchParams.get("from") ?? "0000-01-01"; const to = url.searchParams.get("to") ?? "9999-12-31";
  let headers: string[] = []; let rows: unknown[][] = [];
  if (type === "jobs") {
    const r = await db.from("jobs").select("*").is("deleted_at", null).order("scheduled_for"); if (r.error) throw r.error;
    headers = ["Job", "Date", "Status", "Address", "Service", "Driver ID"];
    rows = (r.data ?? []).filter(j => { const d = pacificDate(j.scheduled_for); return d >= from && d <= to; }).map(j => [j.reference, pacificDate(j.scheduled_for), j.status, j.address, j.service_type, j.assigned_driver_id ?? "Unassigned"]);
  } else if (type === "invoices") {
    const r = await db.from("invoices").select("*").gte("due_date", from).lte("due_date", to).order("due_date"); if (r.error) throw r.error;
    headers = ["Invoice", "Customer ID", "Amount", "Status", "Due Date", "Notes"];
    rows = (r.data ?? []).map(i => [i.invoice_number, i.customer_id, (Number(i.amount_cents) / 100).toFixed(2), i.status, i.due_date, i.notes]);
  } else if (type === "time") {
    const r = await db.from("time_entries").select("*").order("occurred_at"); if (r.error) throw r.error;
    headers = ["Employee ID", "Event", "Timestamp"];
    rows = (r.data ?? []).filter(e => { const d = pacificDate(e.occurred_at); return d >= from && d <= to; }).map(e => [e.user_id, e.entry_type, e.occurred_at]);
  } else {
    const [trucks, dumpsters] = await Promise.all([db.from("trucks").select("*").is("deleted_at", null), db.from("dumpsters").select("*").is("deleted_at", null)]); if (trucks.error || dumpsters.error) throw trucks.error ?? dumpsters.error;
    headers = ["Type", "Asset", "Status", "Location", "AirTag ID"];
    rows = [...(trucks.data ?? []).map(t => ["Truck", t.number, t.status, t.last_known_location ?? "", t.air_tag_id ?? ""]), ...(dumpsters.data ?? []).map(d => ["Dumpster", d.code, d.status, d.current_location, d.air_tag_id ?? ""])];
  }
  const csv = toCsv(headers, rows);
  await db.from("export_audit").insert({ export_type: type, filters: { from, to }, row_count: rows.length, requested_by_id: profile.data.id });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${type}-${from}-${to}.csv"`, "cache-control": "no-store" } });
}
