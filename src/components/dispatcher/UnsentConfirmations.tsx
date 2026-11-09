"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { requestJobConfirmation } from "@/lib/job-confirmations/client";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

interface Unsent {
  job_id: string;
  recipient_email: string;
  send_error: string | null;
}

/**
 * Upcoming jobs whose customer confirmation email never went out. On Nov 1,
 * 2026 a sender outage failed every confirmation that day, and the only sign
 * was "Email not sent" on each job's own page. Hidden when there are none.
 * The morning maintenance run also retries these on its own.
 */
export function UnsentConfirmations() {
  const { jobs, customers, canMutate } = useOperations();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Unsent[]>([]);
  const [sending, setSending] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await createClient()
      .from("job_confirmations")
      .select("job_id,recipient_email,send_error")
      .is("superseded_at", null)
      .is("sent_at", null);
    if (data) setRows(data as Unsent[]);
  }, []);

  React.useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const now = Date.now();
  const unsent = rows
    .map((row) => ({ row, job: jobs.find((job) => job.id === row.job_id) }))
    .filter(
      ({ job }) =>
        job &&
        job.status !== "cancelled" &&
        job.status !== "complete" &&
        new Date(job.scheduledFor).getTime() > now,
    )
    .sort((a, b) => (a.job?.scheduledFor ?? "").localeCompare(b.job?.scheduledFor ?? ""));

  if (!unsent.length) return null;

  const sendAgain = async (jobId: string, email: string) => {
    setSending(jobId);
    try {
      const response = await requestJobConfirmation(jobId, email);
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (response.ok) toast(`Confirmation sent to ${email}.`, { tone: "success" });
      else toast(`Still not sent: ${body.error?.message ?? "the email could not be sent."}`, { tone: "error" });
    } catch {
      toast("Could not reach the server. Try again.", { tone: "error" });
    } finally {
      setSending(null);
      void load();
    }
  };

  return (
    <Card>
      <CardHeader title="Confirmation Emails Not Sent" />
      <ul className="divide-y divide-brand-ice/60">
        {unsent.map(({ row, job }) =>
          job ? (
            <li key={row.job_id} className="px-5 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/dispatcher/jobs/${job.id}`}
                  className="font-semibold text-brand-blue hover:underline"
                >
                  {job.reference} ·{" "}
                  {customers.find((item) => item.id === job.customerId)?.name ?? "Customer"}
                </Link>
                <span className="shrink-0 text-xs text-brand-steel">
                  {formatDateTime(job.scheduledFor)}
                </span>
              </div>
              <p className="mt-0.5 break-words text-brand-steel">
                To {row.recipient_email}
                {row.send_error ? ` · ${row.send_error}` : ""}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={!canMutate || sending === row.job_id}
                onClick={() => void sendAgain(row.job_id, row.recipient_email)}
              >
                {sending === row.job_id ? "Sending…" : "Send again"}
              </Button>
            </li>
          ) : null,
        )}
      </ul>
    </Card>
  );
}
