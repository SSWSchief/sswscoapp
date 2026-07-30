"use client";

import * as React from "react";
import { notFound, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { getCustomer, getJob, getJobActivities } from "@/lib/data";
import { appleMapsUrl } from "@/lib/utils";
import type { JobActivityType, JobStatus } from "@/lib/types";

// Screen 6 — Driver Job Details. Interactive: photos gate completion, notes can
// be added, and Complete requires confirmation (no accidental taps in the cab).
export default function DriverJobDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const job = getJob(params.id);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [status, setStatus] = React.useState<JobStatus>(job?.status ?? "pending");
  const [photoCount, setPhotoCount] = React.useState(job?.photos.length ?? 0);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [activity, setActivity] = React.useState(() => getJobActivities(job?.id));
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  if (!job) return notFound();
  const customer = getCustomer(job.customerId);

  const completed = status === "complete";

  const logAction = (
    nextStatus: Extract<JobStatus, "en_route" | "arrived" | "complete">,
    body: string
  ) => {
    const type: JobActivityType =
      nextStatus === "complete" ? "completed" : nextStatus;
    setStatus(nextStatus);
    setActivity((items) => [
      {
        id: `local-${Date.now()}`,
        jobId: job.id,
        actorId: "u1",
        actorName: "Mike R.",
        type,
        body,
        createdAt: new Date().toISOString(),
        dispatchNotified: true,
      },
      ...items,
    ]);
    toast(`${job.reference} ${body.toLowerCase()}`, { tone: "success" });
  };

  const markDryRun = () => {
    setActivity((items) => [
      {
        id: `dry-${Date.now()}`,
        jobId: job.id,
        actorId: "u1",
        actorName: "Mike R.",
        type: "dry_run",
        body: "Dry run logged from driver portal. Dispatch notified.",
        createdAt: new Date().toISOString(),
        dispatchNotified: true,
      },
      ...items,
    ]);
    toast("Dry run logged and dispatch notified", { tone: "info" });
  };

  const addPhoto = () => {
    setPhotoCount((n) => n + 1);
    toast("Photo added", { tone: "success" });
  };

  const saveNote = () => {
    if (!draft.trim()) return;
    setNotes((n) => [...n, draft.trim()]);
    setDraft("");
    setComposing(false);
    toast("Note added", { tone: "success" });
  };

  const complete = async () => {
    if (photoCount === 0) {
      toast("Add at least one photo before completing.", { tone: "error" });
      return;
    }
    const ok = await confirm({
      title: `Complete ${job.reference}?`,
      message: "This marks the job done and notifies dispatch. You can't undo it from here.",
      confirmLabel: "Complete Job",
    });
    if (!ok) return;
    logAction("complete", "completed by driver");
    toast("Job completed", {
      tone: "success",
      action: { label: "View jobs", onClick: () => router.push("/driver/jobs") },
    });
  };

  return (
    <>
      <MobileHeader title={`Job ${job.reference}`} back="/driver/jobs" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-4 border-b border-brand-ice/60 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-brand-charcoal dark:text-white">
              {customer?.name}
            </h2>
            <JobStatusBadge status={status} />
          </div>
          <p className="text-sm text-brand-steel dark:text-gray-400 mt-1">{job.address}</p>

          <a
            href={appleMapsUrl(job.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 h-12 rounded bg-brand-blue text-white font-heading font-semibold uppercase tracking-wide text-sm active:bg-brand-navy"
          >
            <Icon name="pin" width={18} height={18} />
            Open in Apple Maps
          </a>
        </div>

        <Panel title="Job Information">
          <dl className="space-y-3 text-sm">
            <Info label="Dumpster Size" value={job.dumpsterSize} />
            <Info label="Service Type" value={job.serviceType} />
            <Info label="Notes" value={job.notes || "—"} />
          </dl>
        </Panel>

        <Panel title={`Activity${activity.length ? ` (${activity.length})` : ""}`}>
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-blue shrink-0" />
                <div>
                  <div className="font-medium text-brand-charcoal dark:text-white">
                    {item.body}
                  </div>
                  <div className="text-xs text-brand-steel dark:text-gray-400">
                    {item.actorName} · Dispatch {item.dispatchNotified ? "notified" : "not notified"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={`Photos${photoCount ? ` (${photoCount})` : ""}`}
          required={photoCount === 0}
        >
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: photoCount }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-16 rounded bg-brand-mist dark:bg-white/10 border border-brand-ice dark:border-white/10 flex items-center justify-center text-brand-silver"
              >
                <Icon name="photo" width={22} height={22} />
              </div>
            ))}
            <button
              onClick={addPhoto}
              className="h-16 w-16 rounded border-2 border-dashed border-brand-ice dark:border-white/20 flex flex-col items-center justify-center text-brand-steel active:border-brand-blue active:text-brand-blue"
              aria-label="Add photo"
            >
              <Icon name="plus" width={18} height={18} />
            </button>
          </div>
          {photoCount === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              At least one photo is required to complete this job.
            </p>
          )}
        </Panel>

        <Panel title={`My Notes${notes.length ? ` (${notes.length})` : ""}`}>
          {notes.length > 0 && (
            <ul className="space-y-2 mb-3">
              {notes.map((n, i) => (
                <li
                  key={i}
                  className="text-sm text-brand-charcoal dark:text-gray-300 bg-brand-mist dark:bg-white/5 rounded px-3 py-2"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
          {composing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a note…"
                autoFocus
                className="w-full min-h-[80px] rounded border border-brand-ice dark:border-white/10 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-skyline/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNote}
                  className="h-10 flex-1 rounded bg-brand-blue text-white font-heading text-sm font-medium uppercase tracking-wide"
                >
                  Save Note
                </button>
                <button
                  onClick={() => {
                    setComposing(false);
                    setDraft("");
                  }}
                  className="h-10 px-4 rounded border border-brand-ice dark:border-white/15 text-sm font-medium text-brand-steel dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-blue"
            >
              <Icon name="plus" width={16} height={16} />
              Add note
            </button>
          )}
        </Panel>
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-brand-ice/60 dark:border-white/10 p-4 space-y-3">
        {status === "pending" && (
          <button
            onClick={() => logAction("en_route", "marked en route")}
            className="w-full h-12 rounded bg-status-complete text-white font-heading font-semibold uppercase tracking-wide text-sm"
          >
            En Route
          </button>
        )}
        {status === "en_route" && (
          <button
            onClick={() => logAction("arrived", "marked arrived")}
            className="w-full h-12 rounded bg-brand-blue text-white font-heading font-semibold uppercase tracking-wide text-sm"
          >
            Arrived
          </button>
        )}
        {status === "arrived" && !completed && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={addPhoto}
                className="h-12 rounded border border-brand-blue/40 text-brand-blue font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <Icon name="photo" width={16} height={16} />
                Add Photo
              </button>
              <button
                onClick={() => setComposing(true)}
                className="h-12 rounded border border-brand-blue/40 text-brand-blue font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <Icon name="edit" width={16} height={16} />
                Add Note
              </button>
            </div>
            <button
              onClick={markDryRun}
              className="w-full h-12 rounded border border-amber-300 text-amber-700 font-heading font-semibold uppercase tracking-wide text-sm flex items-center justify-center gap-1.5"
            >
              <Icon name="info" width={16} height={16} />
              Dry Run
            </button>
            <button
              onClick={complete}
              disabled={photoCount === 0}
              className="w-full h-12 rounded bg-status-complete text-white font-heading font-semibold uppercase tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {photoCount === 0 ? "Add a photo to complete" : "Complete Job"}
            </button>
          </>
        )}
        {completed && (
          <div className="flex items-center justify-center gap-2 h-12 text-status-complete font-semibold text-sm">
            <Icon name="check" width={18} height={18} />
            Job complete
          </div>
        )}
      </div>
    </>
  );
}

function Panel({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 mt-3 p-4 border-y border-brand-ice/60 dark:border-white/10">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white mb-3 flex items-center gap-2">
        {title}
        {required && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">
            Required
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:flex sm:justify-between sm:gap-4">
      <dt className="text-brand-steel dark:text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-brand-charcoal dark:text-gray-200 sm:text-right font-medium">
        {value}
      </dd>
    </div>
  );
}
