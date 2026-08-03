"use client";

import * as React from "react";
import { notFound, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { getCustomer } from "@/lib/data";
import { useDemoState } from "@/components/system/DemoStateProvider";
import type { JobStatus } from "@/lib/types";
import { PlatformMapLink } from "@/components/ui/PlatformMapLink";

// Screen 6 — Driver Job Details. Interactive: photos gate completion, notes can
// be added, and Complete requires confirmation (no accidental taps in the cab).
export default function DriverJobDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const { jobs, activities, hydrated, updateJobStatus, logDryRun } = useDemoState();
  const job = jobs.find(
    (item) => item.id === params.id || item.reference === params.id || item.reference === `#${params.id}`
  );
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [photos, setPhotos] = React.useState<(string | null)[]>(() => job?.photos.map(() => null) ?? []);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const libraryInputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlsRef = React.useRef<string[]>([]);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => () => objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  React.useEffect(() => {
    if (job && photos.length === 0 && job.photos.length > 0) {
      setPhotos(job.photos.map(() => null));
    }
  }, [job, photos.length]);

  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!job) return notFound();
  const status = job.status;
  const activity = activities.filter((item) => item.jobId === job.id);
  const customer = getCustomer(job.customerId);

  const completed = status === "complete";
  const photoCount = photos.length;

  const logAction = (
    nextStatus: Extract<JobStatus, "en_route" | "arrived" | "complete">,
    body: string
  ) => {
    updateJobStatus(job.id, nextStatus, "u1", "Mike R.");
    toast(`${job.reference} ${body.toLowerCase()}`, { tone: "success" });
  };

  const markDryRun = () => {
    logDryRun(job.id, "u1", "Mike R.");
    toast("Dry run logged and dispatch notified", { tone: "info" });
  };

  const addPhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const valid = selected.filter((file) => file.type.startsWith("image/") && file.size <= 15 * 1024 * 1024);
    if (valid.length !== selected.length) {
      toast("Use image files no larger than 15 MB.", { tone: "error" });
    }
    if (valid.length) {
      const urls = valid.map((file) => URL.createObjectURL(file));
      objectUrlsRef.current.push(...urls);
      setPhotos((current) => [...current, ...urls]);
      toast(`${valid.length} photo${valid.length === 1 ? "" : "s"} ready`, { tone: "success" });
    }
    event.target.value = "";
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

          <div className="mt-3 grid grid-cols-2 gap-3">
            <PlatformMapLink address={job.address} className="flex min-h-12 items-center justify-center gap-2 rounded bg-brand-blue px-2 text-center font-heading text-sm font-semibold uppercase tracking-wide text-white active:bg-brand-navy"><Icon name="pin" width={18} height={18} />Navigate</PlatformMapLink>
            <a href={`tel:${job.phone.replace(/[^\d+]/g, "")}`} className="flex min-h-12 items-center justify-center gap-2 rounded border border-brand-blue/40 px-2 text-center font-heading text-sm font-semibold uppercase tracking-wide text-brand-blue"><Icon name="customers" width={18} height={18} />Call Customer</a>
          </div>
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
            {photos.map((url, i) => (
              <div
                key={url ?? `seed-${i}`}
                className="h-16 w-16 rounded bg-brand-mist dark:bg-white/10 border border-brand-ice dark:border-white/10 flex items-center justify-center text-brand-silver"
                style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                role={url ? "img" : undefined}
                aria-label={url ? `Selected job photo ${i + 1}` : undefined}
              >
                {!url && <Icon name="photo" width={22} height={22} />}
              </div>
            ))}
            <button
              onClick={() => libraryInputRef.current?.click()}
              className="h-16 w-16 rounded border-2 border-dashed border-brand-ice dark:border-white/20 flex flex-col items-center justify-center text-brand-steel active:border-brand-blue active:text-brand-blue"
              aria-label="Choose photo from library"
            >
              <Icon name="plus" width={18} height={18} />
            </button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={addPhotos} className="sr-only" aria-label="Take job photo" />
            <input ref={libraryInputRef} type="file" accept="image/*" multiple onChange={addPhotos} className="sr-only" aria-label="Choose job photos" />
          </div>
          {photoCount === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              At least one photo is required to complete this job.
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-brand-steel dark:text-gray-400">
            Demo preview only. Photos stay on this screen and will not upload until secure storage is connected.
          </p>
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
                className="w-full min-h-[80px] rounded border border-brand-ice dark:border-white/10 dark:bg-gray-800 dark:text-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-skyline/40 sm:text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNote}
                  className="min-h-11 flex-1 rounded bg-brand-blue text-white font-heading text-sm font-medium uppercase tracking-wide"
                >
                  Save Note
                </button>
                <button
                  onClick={() => {
                    setComposing(false);
                    setDraft("");
                  }}
                  className="min-h-11 px-4 rounded border border-brand-ice dark:border-white/15 text-sm font-medium text-brand-steel dark:text-gray-300"
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
      <div className="safe-area-bottom-padded shrink-0 bg-white dark:bg-gray-900 border-t border-brand-ice/60 dark:border-white/10 px-4 pt-4 space-y-3">
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
                onClick={() => cameraInputRef.current?.click()}
                className="h-12 rounded border border-brand-blue/40 text-brand-blue font-medium text-sm flex items-center justify-center gap-1.5"
              >
                <Icon name="photo" width={16} height={16} />
                Take Photo
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
