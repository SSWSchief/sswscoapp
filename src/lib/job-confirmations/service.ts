import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resolveAppUrl } from "@/lib/app-url";
import { customerEmailConfigured, dispatchEmail, sendEmail } from "@/lib/email/resend";
import { deliverPendingNotifications } from "@/lib/push/deliver";
import { renderChangeRequestEmail, renderConfirmationEmail } from "./email";

type Db = SupabaseClient<Database>;

type ConfirmationProblem =
  | "not_configured"
  | "not_found"
  | "job_closed"
  | "no_email"
  | "superseded";

export class ConfirmationError extends Error {
  constructor(readonly problem: ConfirmationProblem, message: string) {
    super(message);
  }
}

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function loadJob(db: Db, jobId: string) {
  const job = await db
    .from("jobs")
    .select("id,reference,customer_id,address,service_type,dumpster_size,scheduled_for,status,deleted_at")
    .eq("id", jobId)
    .maybeSingle();
  if (job.error) throw job.error;
  if (!job.data || job.data.deleted_at) throw new ConfirmationError("not_found", "Job not found.");
  return job.data;
}

async function companyContact(db: Db) {
  const settings = await db.from("company_settings").select("company_name,phone").maybeSingle();
  if (settings.error) throw settings.error;
  return {
    companyName: settings.data?.company_name || "Silver State Waste Solutions",
    companyPhone: settings.data?.phone ?? "",
  };
}

/**
 * Email the customer their job's details with Confirm / Request a change
 * links, replacing any earlier confirmation for the job. Sending is recorded
 * either way, so dispatch can see a failure and retry.
 *
 * `email` is dispatch's choice of recipient; without one it is the customer's
 * profile email, then their billing email. An address typed for a customer
 * whose profile has none is saved to the profile for next time.
 */
export async function sendJobConfirmation(
  db: Db,
  options: { jobId: string; email?: string; requestedById: string | null },
) {
  if (!customerEmailConfigured())
    throw new ConfirmationError("not_configured", "Confirmation emails are not turned on yet.");
  const job = await loadJob(db, options.jobId);
  if (job.status === "cancelled" || job.status === "complete")
    throw new ConfirmationError("job_closed", "This job is already closed.");
  const customer = await db.from("customers").select("id,name,email,billing_email").eq("id", job.customer_id).maybeSingle();
  if (customer.error) throw customer.error;
  const typed = options.email?.trim() ?? "";
  if (typed && !emailPattern.test(typed))
    throw new ConfirmationError("no_email", "Enter a valid email address.");
  const recipient = typed || customer.data?.email?.trim() || customer.data?.billing_email?.trim() || "";
  if (!emailPattern.test(recipient))
    throw new ConfirmationError("no_email", "This customer has no email on file.");
  if (typed && customer.data && !customer.data.email?.trim()) {
    const saved = await db.from("customers").update({ email: typed }).eq("id", customer.data.id);
    if (saved.error) throw saved.error;
  }

  const previous = await db
    .from("job_confirmations")
    .select("id,scheduled_for")
    .eq("job_id", job.id)
    .is("superseded_at", null)
    .maybeSingle();
  if (previous.error) throw previous.error;
  if (previous.data) {
    const superseded = await db
      .from("job_confirmations")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", previous.data.id);
    if (superseded.error) throw superseded.error;
  }
  const rescheduled = Boolean(
    previous.data && new Date(previous.data.scheduled_for).getTime() !== new Date(job.scheduled_for).getTime(),
  );

  const token = randomBytes(32).toString("base64url");
  const created = await db
    .from("job_confirmations")
    .insert({
      job_id: job.id,
      token_hash: hashToken(token),
      recipient_email: recipient,
      scheduled_for: job.scheduled_for,
      requested_by_id: options.requestedById,
    })
    .select("id")
    .single();
  if (created.error) throw created.error;

  const link = `${resolveAppUrl().url}/confirm/${token}`;
  const message = renderConfirmationEmail({
    ...(await companyContact(db)),
    customerName: customer.data?.name ?? "",
    reference: job.reference,
    serviceType: job.service_type,
    dumpsterSize: job.dumpster_size,
    address: job.address,
    scheduledFor: job.scheduled_for,
    confirmUrl: link,
    changeUrl: `${link}?change=1#change`,
    rescheduled,
  });
  try {
    const providerId = await sendEmail({
      to: recipient,
      replyTo: dispatchEmail(),
      ...message,
      idempotencyKey: `job-confirmation:${created.data.id}`,
    });
    const sentAt = new Date().toISOString();
    const saved = await db
      .from("job_confirmations")
      .update({ sent_at: sentAt, provider_message_id: providerId, send_error: null })
      .eq("id", created.data.id);
    if (saved.error) throw saved.error;
    return { id: created.data.id, recipient, sentAt, error: null };
  } catch (error) {
    const reason = (error instanceof Error ? error.message : "The email could not be sent.").slice(0, 300);
    await db.from("job_confirmations").update({ send_error: reason }).eq("id", created.data.id);
    return { id: created.data.id, recipient, sentAt: null, error: reason };
  }
}

/** What the customer's confirmation page shows. Null for an unknown link. */
export async function loadConfirmation(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const row = await db
    .from("job_confirmations")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (row.error) throw row.error;
  if (!row.data) return null;
  const job = await loadJob(db, row.data.job_id).catch(() => null);
  const customer = job
    ? await db.from("customers").select("name").eq("id", job.customer_id).maybeSingle()
    : null;
  return {
    confirmation: row.data,
    job,
    customerName: customer?.data?.name ?? "",
    ...(await companyContact(db)),
  };
}

/**
 * Record the customer's answer. Asking for a change alerts dispatch in the
 * app and by email, with the customer as the reply-to, so a reply reaches
 * them directly. Nothing about the job itself changes: dispatch calls.
 */
export async function respondToConfirmation(
  db: Db,
  token: string,
  answer: { action: "confirmed" | "change_requested"; note: string },
) {
  const loaded = await loadConfirmation(db, token);
  if (!loaded || !loaded.job) throw new ConfirmationError("not_found", "This link is not valid.");
  const { confirmation, job } = loaded;
  if (confirmation.superseded_at)
    throw new ConfirmationError("superseded", "This job was rescheduled. Use the link in your newest email.");
  if (job.status === "cancelled" || job.status === "complete")
    throw new ConfirmationError("job_closed", "This job is already closed.");
  const note = answer.action === "change_requested" ? answer.note.trim().slice(0, 1000) : "";
  const respondedAt = new Date().toISOString();
  const saved = await db
    .from("job_confirmations")
    .update({ response: answer.action, response_note: note, responded_at: respondedAt })
    .eq("id", confirmation.id)
    .is("superseded_at", null);
  if (saved.error) throw saved.error;
  if (answer.action !== "change_requested") return;

  const who = loaded.customerName || confirmation.recipient_email;
  const staff = await db
    .from("users")
    .select("id")
    .in("access_role", ["admin", "dispatcher"])
    .eq("status", "active")
    .is("deleted_at", null);
  if (!staff.error && staff.data.length) {
    const notified = await db.from("notifications").insert(
      staff.data.map((person) => ({
        recipient_user_id: person.id,
        source_role: "dispatcher" as const,
        category: "dispatch_update",
        title: `Change requested: ${job.reference}`,
        body: `${who} asked for a change${note ? `: "${note.slice(0, 200)}"` : "."}`,
        related_job_id: job.id,
        requires_acknowledgement: true,
      })),
    );
    if (!notified.error) await deliverPendingNotifications(db).catch(() => undefined);
  }
  const message = renderChangeRequestEmail({
    reference: job.reference,
    customerName: loaded.customerName,
    recipientEmail: confirmation.recipient_email,
    scheduledFor: confirmation.scheduled_for,
    note,
    jobUrl: `${resolveAppUrl().url}/dispatcher/jobs/${job.id}`,
  });
  await sendEmail({
    to: dispatchEmail(),
    replyTo: confirmation.recipient_email,
    ...message,
    idempotencyKey: `job-confirmation:${confirmation.id}:change:${respondedAt}`,
  }).catch(() => undefined);
}
