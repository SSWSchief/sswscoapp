"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { formatDateTime, formatTime } from "@/lib/utils";
import type { AcknowledgementEntry, JobEvent } from "@/lib/types";
import { CreateJobModal } from "@/components/dispatcher/CreateJobModal";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { ReasonDialog } from "@/components/ui/ReasonDialog";

// Screen 4 — Job Details (dispatcher view).
export default function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const {
    jobs,
    activities: allActivities,
    customers,
    dumpsters,
    jobNotes,
    trucks,
    users,
    hydrated,
    completeJobAsDispatcher,
    cancelJob,
    uploadJobPhotos,
    canMutate,
  } = useOperations();
  const [editOpen, setEditOpen] = React.useState(false);
  const [reasonMode, setReasonMode] = React.useState<
    "cancel" | "complete" | null
  >(null);
  const [busy, setBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const confirm = useConfirm();
  const job = jobs.find(
    (item) =>
      item.id === id || item.reference === id || item.reference === `#${id}`,
  );
  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!job) notFound();

  const customer = customers.find((item) => item.id === job.customerId);
  const driver = job.assignedDriverId
    ? users.find((item) => item.id === job.assignedDriverId)
    : null;
  const truck = job.assignedTruckId
    ? trucks.find((item) => item.id === job.assignedTruckId)
    : null;
  const dumpster = job.assignedDumpsterId
    ? dumpsters.find((item) => item.id === job.assignedDumpsterId)
    : null;
  const notes = jobNotes.filter((item) => item.jobId === job.id);
  const activities = allActivities.filter(
    (activity) => activity.jobId === job.id,
  );
  const complete = async (reason?: string) => {
    if (busy) return;
    const ok = await confirm({
      title: `Complete ${job.reference}?`,
      message: "This records completion in the permanent audit history.",
      confirmLabel: "Complete Job",
    });
    if (!ok) return;
    setBusy(true);
    const result = await completeJobAsDispatcher(job.id, reason);
    setBusy(false);
    toast(result.ok ? "Job completed" : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok) setReasonMode(null);
  };
  const cancel = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    const result = await cancelJob(job.id, reason);
    setBusy(false);
    toast(result.ok ? "Job cancelled" : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok) setReasonMode(null);
  };
  const addPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    const result = await uploadJobPhotos(job.id, files);
    setBusy(false);
    toast(
      result.ok
        ? `${files.length} photo${files.length === 1 ? "" : "s"} uploaded`
        : result.error.message,
      { tone: result.ok ? "success" : "error" },
    );
    event.target.value = "";
  };

  return (
    <>
      <Topbar
        title={`Job ${job.reference}`}
        action={
          <div className="flex gap-2">
            <Button
              disabled={!canMutate || busy}
              variant="secondary"
              aria-label="Edit job"
              onClick={() => setEditOpen(true)}
            >
              <Icon name="edit" width={16} height={16} />
              <span className="hidden lg:inline">Edit Job</span>
            </Button>
            {job.status !== "complete" && job.status !== "cancelled" && (
              <Button
                disabled={!canMutate || busy}
                variant="danger"
                onClick={() => setReasonMode("cancel")}
              >
                Cancel
              </Button>
            )}
            {job.status === "arrived" && (
              <Button
                disabled={!canMutate || busy}
                onClick={() =>
                  job.photos.length
                    ? void complete()
                    : setReasonMode("complete")
                }
                aria-label="Mark job complete"
              >
                <Icon name="check" width={16} height={16} />
                <span className="hidden lg:inline">Mark Complete</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="portal-content space-y-5">
        <Link
          href="/dispatcher/jobs"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand-steel hover:text-brand-charcoal"
        >
          <Icon
            name="chevron-right"
            width={16}
            height={16}
            className="rotate-180"
          />
          Back to Jobs
        </Link>

        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
            Job {job.reference}
          </h2>
          <JobStatusBadge status={job.status} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Job Information */}
          <Card className="lg:col-span-1">
            <CardHeader title="Job Information" />
            <dl className="px-5 py-4 space-y-3.5 text-sm">
              <Row label="Customer" value={customer?.name} />
              <Row label="Address" value={job.address} />
              <Row label="Phone" value={job.phone} />
              <Row label="Service Type" value={job.serviceType} />
              <Row label="Dumpster Size" value={job.dumpsterSize} />
              <Row
                label="Scheduled Date"
                value={formatDateTime(job.scheduledFor)}
              />
              <Row label="Notes" value={job.notes || "—"} />
            </dl>
          </Card>

          {/* Assignments */}
          <Card className="lg:col-span-1">
            <CardHeader title="Assignments" />
            <div className="px-5 py-4 space-y-4">
              <Assignment
                icon="employees"
                label="Driver"
                value={driver?.fullName ?? "Unassigned"}
                initials={driver?.initials}
              />
              <Assignment
                icon="truck"
                label="Truck"
                value={truck?.number ?? "Unassigned"}
              />
              <Assignment
                icon="dumpster"
                label="Dumpster"
                value={dumpster?.code ?? "Unassigned"}
              />
              {job.assignedDriverId && (
                <AssignmentAcknowledgement jobId={job.id} />
              )}
            </div>
          </Card>

          {/* Job Status timeline */}
          <Card className="lg:col-span-1">
            <CardHeader title="Job Status" />
            <ol className="px-5 py-4 space-y-4">
              {job.timeline.map((event, i) => (
                <TimelineStep
                  key={event.type}
                  event={event}
                  last={i === job.timeline.length - 1}
                />
              ))}
            </ol>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Photos */}
          <Card>
            <CardHeader title="Photos" />
            <div className="px-5 py-4 flex flex-wrap gap-3">
              {job.photos.map((p) => (
                <div
                  key={p.id}
                  className="h-20 w-20 rounded bg-brand-mist border border-brand-ice flex items-center justify-center text-brand-silver"
                  style={
                    p.url
                      ? {
                          backgroundImage: `url(${p.url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                  role={p.url ? "img" : undefined}
                  aria-label={p.url ? "Job photo" : undefined}
                >
                  {!p.url && <Icon name="photo" width={26} height={26} />}
                </div>
              ))}
              <button
                disabled={!canMutate || busy}
                onClick={() => fileInput.current?.click()}
                className="h-20 w-20 rounded border-2 border-dashed border-brand-ice flex flex-col items-center justify-center text-brand-steel hover:border-brand-blue hover:text-brand-blue transition-colors disabled:opacity-50"
              >
                <Icon name="plus" width={20} height={20} />
                <span className="text-[11px] mt-1">Add Photo</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
                className="sr-only"
                aria-label="Add job photos"
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="px-5 py-4 space-y-4">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-blue shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-brand-charcoal">
                        {a.actorName}
                      </span>
                      <span className="text-xs text-brand-silver">
                        {formatTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-brand-steel">{a.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Job Notes" />
            <ul className="px-5 py-4 space-y-4">
              {notes.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <Avatar initials={n.authorName.slice(0, 2)} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-brand-charcoal">
                        {n.authorName}
                      </span>
                      <span className="text-xs text-brand-silver">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-brand-steel">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <CreateJobModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        job={job}
      />
      <ReasonDialog
        open={reasonMode === "cancel"}
        onClose={() => setReasonMode(null)}
        onSubmit={cancel}
        busy={busy}
        title={`Cancel ${job.reference}`}
        label="Cancellation reason"
        confirmLabel="Cancel Job"
      />
      <ReasonDialog
        open={reasonMode === "complete"}
        onClose={() => setReasonMode(null)}
        onSubmit={(reason) => complete(reason)}
        busy={busy}
        title={`Complete ${job.reference} without a photo`}
        label="Dispatcher override reason"
        confirmLabel="Complete Job"
      />
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="font-heading text-xs uppercase tracking-wide text-brand-steel">
        {label}
      </dt>
      <dd className="text-brand-charcoal mt-0.5">{value}</dd>
    </div>
  );
}

function Assignment({
  icon,
  label,
  value,
  initials,
}: {
  icon: "employees" | "truck" | "dumpster" | "clipboard";
  label: string;
  value: string;
  initials?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded bg-brand-blue/10 text-brand-blue flex items-center justify-center">
        <Icon name={icon} width={18} height={18} />
      </div>
      <div>
        <div className="text-xs text-brand-steel">{label}</div>
        <div className="text-sm font-medium text-brand-charcoal flex items-center gap-1.5">
          {initials && <Avatar initials={initials} size="sm" />}
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * Whether the assigned driver has acknowledged the job. The assignment
 * notification has always asked drivers to acknowledge; this surfaces the
 * answer to dispatch, who previously had no way to see it.
 */
function AssignmentAcknowledgement({ jobId }: { jobId: string }) {
  const { loadJobAcknowledgements } = useExpandedOperations();
  const [entries, setEntries] = React.useState<AcknowledgementEntry[] | null>(
    null,
  );

  React.useEffect(() => {
    let active = true;
    void loadJobAcknowledgements(jobId).then((result) => {
      if (active) setEntries(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, [jobId, loadJobAcknowledgements]);

  const acknowledged = entries?.find((entry) => entry.acknowledgedAt);
  const value = !entries
    ? "Checking…"
    : acknowledged
      ? `Acknowledged ${formatDateTime(acknowledged.acknowledgedAt!)}`
      : entries.length
        ? "Awaiting driver acknowledgement"
        : "No assignment alert sent";

  return <Assignment icon="clipboard" label="Acknowledgement" value={value} />;
}

const eventLabel: Record<JobEvent["type"], string> = {
  created: "Created",
  assigned: "Assigned",
  en_route: "En Route",
  arrived: "Arrived",
  dry_run: "Dry Run",
  completed: "Completed",
};

function TimelineStep({ event, last }: { event: JobEvent; last: boolean }) {
  const done = event.at !== null;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={
            done
              ? "h-3 w-3 rounded-full bg-status-complete"
              : "h-3 w-3 rounded-full border-2 border-brand-ice bg-white"
          }
        />
        {!last && <span className="w-px flex-1 bg-brand-ice my-1" />}
      </div>
      <div className="pb-1">
        <div className="text-sm font-medium text-brand-charcoal">
          {eventLabel[event.type]}
        </div>
        <div className="text-xs text-brand-silver">
          {event.at ? formatDateTime(event.at) : "—"}
        </div>
      </div>
    </li>
  );
}
