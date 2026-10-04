import type { Metadata } from "next";
import { LogoFull } from "@/components/ui/Logo";
import { confirmationWhen, formatPhone } from "@/lib/job-confirmations/email";
import { loadConfirmation } from "@/lib/job-confirmations/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirm your job",
  robots: { index: false, follow: false },
};

const problems: Record<string, string> = {
  superseded: "This job was rescheduled. Please use the link in your newest email.",
  job_closed: "This job is already closed, so it can no longer be changed here.",
  not_found: "This link is not valid.",
  invalid: "Choose Confirm or Request a change.",
  failed: "Your answer could not be saved. Please try again, or call us.",
};

/**
 * Where the emailed Confirm and Request a change buttons land. Opening it
 * records nothing: mail filters open links to scan them, so the answer is
 * only taken from the buttons on this page.
 */
export default async function ConfirmJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const loaded = await loadConfirmation(createAdminClient(), token).catch(() => null);
  const phone = loaded ? formatPhone(loaded.companyPhone) : "";

  if (!loaded || !loaded.job)
    return <Shell><Heading>Link not found</Heading><Muted>This confirmation link is not valid. If you booked a dumpster with us, reply to our email and we&apos;ll help.</Muted></Shell>;

  const { confirmation, job } = loaded;
  const when = confirmationWhen(confirmation.scheduled_for);
  const closed = job.status === "cancelled" || job.status === "complete";
  const superseded = Boolean(confirmation.superseded_at);
  const answered = query.answered ?? confirmation.response;
  const error = query.error ? problems[query.error] ?? problems.failed : null;
  const action = `/api/confirmations/${encodeURIComponent(token)}`;

  return (
    <Shell>
      <Heading>Job {job.reference}</Heading>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
        <Detail label="Service" value={job.service_type} />
        <Detail label="Dumpster" value={job.dumpster_size} />
        <Detail label="Address" value={job.address} />
        <Detail label="Date" value={when.date} />
        <Detail label="Time" value={when.time} />
      </dl>
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {superseded ? (
        <Muted>This job was rescheduled. Please use the link in your newest email.</Muted>
      ) : job.status === "cancelled" ? (
        <Muted>This job was cancelled. Call us if that&apos;s not right.</Muted>
      ) : closed ? (
        <Muted>This job is complete. Thank you for your business.</Muted>
      ) : answered === "confirmed" ? (
        <Notice>Thank you, you&apos;re confirmed. We&apos;ll see you {when.date} at {when.time}.</Notice>
      ) : answered === "change_requested" ? (
        <Notice>Thanks. Our dispatch team has your request and will contact you shortly.</Notice>
      ) : null}
      {!superseded && !closed && answered !== "confirmed" && (
        <form method="post" action={action} className="mt-6">
          <input type="hidden" name="action" value="confirmed" />
          <button type="submit" className="flex min-h-11 w-full items-center justify-center rounded bg-brand-blue px-4 font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Confirm
          </button>
        </form>
      )}
      {!superseded && !closed && (
        <form id="change" method="post" action={action} className="mt-6 border-t border-brand-ice pt-5 text-left">
          <input type="hidden" name="action" value="change_requested" />
          <label htmlFor="note" className="text-sm font-semibold text-brand-charcoal">
            {answered === "change_requested" ? "Anything else to add?" : "Need a different date, time, or something else?"}
          </label>
          <textarea id="note" name="note" maxLength={1000} rows={3} autoFocus={query.change === "1"} className="mt-2 w-full rounded border border-brand-ice p-2 text-sm" placeholder="Tell us what to change" />
          <button type="submit" className="mt-2 flex min-h-11 w-full items-center justify-center rounded border border-brand-blue px-4 font-heading text-sm font-semibold uppercase tracking-wide text-brand-blue">
            Request a change
          </button>
        </form>
      )}
      <p className="mt-6 text-xs text-brand-steel">
        {loaded.companyName}{phone ? ` · ${phone}` : ""}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-viewport-height flex items-center justify-center bg-brand-mist p-4 safe-area-all">
      <div className="w-full max-w-md rounded-card border border-brand-ice bg-white p-6 text-center shadow-card">
        <LogoFull className="justify-center" />
        {children}
      </div>
    </main>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-4 font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">{children}</h1>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm leading-6 text-brand-steel">{children}</p>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{children}</p>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-brand-steel">{label}</dt>
      <dd className="font-semibold text-brand-charcoal">{value}</dd>
    </>
  );
}
