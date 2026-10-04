"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import { requestJobConfirmation } from "@/lib/job-confirmations/client";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";

interface CurrentConfirmation {
  id: string;
  recipient_email: string;
  scheduled_for: string;
  sent_at: string | null;
  send_error: string | null;
  response: "confirmed" | "change_requested" | null;
  response_note: string;
  responded_at: string | null;
}

type ConfirmationState = "confirmed" | "change_requested" | "waiting" | "failed";

function stateOf(row: Pick<CurrentConfirmation, "response" | "sent_at">): ConfirmationState {
  if (row.response) return row.response;
  return row.sent_at ? "waiting" : "failed";
}

const labels: Record<ConfirmationState, string> = {
  confirmed: "Customer confirmed",
  change_requested: "Change requested",
  waiting: "Awaiting customer",
  failed: "Email not sent",
};
const tones: Record<ConfirmationState, string> = {
  confirmed: "text-green-700",
  change_requested: "text-amber-700",
  waiting: "text-brand-steel",
  failed: "text-red-600",
};

/** The customer's answer for each job on the board, keyed by job id. */
export function useJobConfirmationStates() {
  const [states, setStates] = React.useState<Map<string, ConfirmationState>>(new Map());
  React.useEffect(() => {
    let cancelled = false;
    const load = () =>
      void createClient()
        .from("job_confirmations")
        .select("job_id,response,sent_at")
        .is("superseded_at", null)
        .then(({ data }) => {
          if (!cancelled && data)
            setStates(new Map(data.map((row) => [row.job_id, stateOf(row)])));
        });
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, []);
  return states;
}

export function JobConfirmationBadge({ state }: { state: ConfirmationState | undefined }) {
  if (!state) return null;
  return <span className={cn("block text-xs font-medium", tones[state])}>{labels[state]}</span>;
}

/** The job page's view of the customer confirmation, with send and resend. */
export function JobConfirmationCard({
  jobId,
  scheduledFor,
  customerEmail,
  closed,
}: {
  jobId: string;
  scheduledFor: string;
  customerEmail: string;
  closed: boolean;
}) {
  const { toast } = useToast();
  const [loaded, setLoaded] = React.useState<{ enabled: boolean; current: CurrentConfirmation | null } | null>(null);
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/confirmation`);
    if (!response.ok) return;
    const body = (await response.json()) as { data: { enabled: boolean; current: CurrentConfirmation | null } };
    setLoaded(body.data);
    setEmail((typed) => typed || body.data.current?.recipient_email || customerEmail);
  }, [jobId, customerEmail]);

  React.useEffect(() => {
    void load();
  }, [load, scheduledFor]);

  const send = async () => {
    setSending(true);
    try {
      const response = await requestJobConfirmation(jobId, email.trim() || undefined);
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (response.ok) toast(`Confirmation sent to ${email.trim()}.`, { tone: "success" });
      else toast(body.error?.message ?? "The confirmation could not be sent.", { tone: "error" });
      await load();
    } finally {
      setSending(false);
    }
  };

  const current = loaded?.current ?? null;
  const state = current ? stateOf(current) : null;
  const outdated = Boolean(current && new Date(current.scheduled_for).getTime() !== new Date(scheduledFor).getTime());

  return (
    <Card>
      <CardHeader title="Customer Confirmation" />
      <div className="space-y-3 px-5 py-4 text-sm">
        {!loaded ? (
          <p className="text-brand-steel">Loading…</p>
        ) : !loaded.enabled ? (
          <p className="text-brand-steel">Customer confirmation emails aren&apos;t turned on yet.</p>
        ) : (
          <>
            {!current ? (
              <p className="text-brand-steel">{customerEmail ? "No confirmation sent yet." : "No email on file for this customer. Add one below to send a confirmation, or call them."}</p>
            ) : (
              <div>
                <p className={cn("font-semibold", state ? tones[state] : "")}>{state ? labels[state] : ""}</p>
                <p className="mt-1 text-brand-steel">
                  {current.sent_at
                    ? `Sent to ${current.recipient_email} on ${formatDateTime(current.sent_at)}.`
                    : `Could not send to ${current.recipient_email}: ${current.send_error ?? "unknown error"}.`}
                  {current.responded_at && ` Answered ${formatDateTime(current.responded_at)}.`}
                </p>
                {current.response === "change_requested" && current.response_note && (
                  <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">&ldquo;{current.response_note}&rdquo;</p>
                )}
                {outdated && <p className="mt-2 text-amber-700">Sent for an earlier time. Resend so the customer sees the new one.</p>}
              </div>
            )}
            {!closed && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input type="email" aria-label="Customer email" placeholder="customer@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                <Button disabled={sending || !email.trim()} onClick={() => void send()}>
                  {sending ? "Sending…" : current ? "Resend" : "Send confirmation"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
