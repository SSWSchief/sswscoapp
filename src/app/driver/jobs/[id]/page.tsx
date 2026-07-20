"use client";

import * as React from "react";
import { notFound, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { getCustomer, getJob } from "@/lib/data";
import { appleMapsUrl } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

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
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  if (!job) return notFound();
  const customer = getCustomer(job.customerId);

  const started = status === "in_progress" || status === "completed";
  const completed = status === "completed";

  const start = () => {
    setStatus("in_progress");
    toast("Job started", { tone: "success" });
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
    setStatus("completed");
    toast("Job completed", {
      tone: "success",
      action: { label: "View jobs", onClick: () => router.push("/driver/jobs") },
    });
  };

  return (
    <>
      <MobileHeader title={`Job ${job.reference}`} back="/driver/jobs" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {customer?.name}
            </h2>
            <JobStatusBadge status={status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{job.address}</p>

          <a
            href={appleMapsUrl(job.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 h-12 rounded-lg bg-brand text-white font-semibold text-sm active:bg-[#003a86]"
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

        <Panel
          title={`Photos${photoCount ? ` (${photoCount})` : ""}`}
          required={photoCount === 0}
        >
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: photoCount }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-300"
              >
                <Icon name="photo" width={22} height={22} />
              </div>
            ))}
            <button
              onClick={addPhoto}
              className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center text-gray-400 active:border-brand active:text-brand-500"
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
                  className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2"
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
                className="w-full min-h-[80px] rounded-lg border border-gray-300 dark:border-white/10 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNote}
                  className="h-10 flex-1 rounded-lg bg-brand text-white text-sm font-medium"
                >
                  Save Note
                </button>
                <button
                  onClick={() => {
                    setComposing(false);
                    setDraft("");
                  }}
                  className="h-10 px-4 rounded-lg border border-gray-300 dark:border-white/15 text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-500"
            >
              <Icon name="plus" width={16} height={16} />
              Add note
            </button>
          )}
        </Panel>
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-white/10 p-4 space-y-3">
        {!started && (
          <button
            onClick={start}
            className="w-full h-12 rounded-lg bg-status-complete text-white font-semibold text-sm"
          >
            Start Job
          </button>
        )}
        {started && !completed && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={addPhoto}
                className="h-12 rounded-lg border border-brand/30 text-brand-500 font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <Icon name="photo" width={16} height={16} />
                Add Photo
              </button>
              <button
                onClick={() => setComposing(true)}
                className="h-12 rounded-lg border border-brand/30 text-brand-500 font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <Icon name="edit" width={16} height={16} />
                Add Note
              </button>
            </div>
            <button
              onClick={complete}
              disabled={photoCount === 0}
              className="w-full h-12 rounded-lg bg-status-complete text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {photoCount === 0 ? "Add a photo to complete" : "Complete Job"}
            </button>
          </>
        )}
        {completed && (
          <div className="flex items-center justify-center gap-2 h-12 text-status-complete font-semibold text-sm">
            <Icon name="check" width={18} height={18} />
            Job completed
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
    <div className="bg-white dark:bg-gray-900 mt-3 p-4 border-y border-gray-100 dark:border-white/10">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
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
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="text-gray-800 dark:text-gray-200 text-right font-medium">
        {value}
      </dd>
    </div>
  );
}
