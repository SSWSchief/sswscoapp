import { authorizedInvoiceApi } from "@/lib/invoices/api";

export async function GET(request: Request) {
  const api = await authorizedInvoiceApi(request, "/api/invoices/eligible-jobs", "GET");
  if (api.denied) return api.denied;
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim();
  const invoiceId = url.searchParams.get("invoiceId")?.trim() || null;
  if (!customerId) return api.fail("customer_required", "Select a customer first.", 400);
  const jobs = await api.access.db
    .from("jobs")
    .select("id,reference,service_type,dumpster_size,scheduled_for")
    .eq("customer_id", customerId)
    .eq("status", "complete")
    .is("deleted_at", null)
    .order("scheduled_for", { ascending: false })
    .limit(500);
  if (jobs.error) return api.fail("eligible_jobs_failed", "Eligible jobs could not be loaded.", 500);
  const ids = jobs.data.map((job) => job.id);
  const allowedInvoiceIds = invoiceId ? [invoiceId] : [];
  if (invoiceId) {
    const current = await api.access.db.from("invoices").select("revised_from_id").eq("id", invoiceId).maybeSingle();
    if (current.error) return api.fail("eligible_jobs_failed", "Eligible jobs could not be loaded.", 500);
    if (current.data?.revised_from_id) allowedInvoiceIds.push(current.data.revised_from_id);
  }
  const activeLinks = ids.length
    ? await api.access.db.from("invoice_jobs").select("job_id,invoice_id").in("job_id", ids).eq("active", true)
    : { data: [], error: null };
  if (activeLinks.error) return api.fail("eligible_jobs_failed", "Eligible jobs could not be loaded.", 500);
  const blocked = new Set((activeLinks.data ?? []).filter((link) => !allowedInvoiceIds.includes(link.invoice_id)).map((link) => link.job_id));
  return api.success(jobs.data.filter((job) => !blocked.has(job.id)).map((job) => ({
    id: job.id,
    reference: job.reference,
    serviceType: job.service_type,
    dumpsterSize: job.dumpster_size,
    scheduledFor: job.scheduled_for,
  })));
}
