import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CURRENT_DRIVER_ID,
  getCustomer,
  getDumpster,
  getJobsForDriver,
  getTruck,
} from "@/lib/data";
import { appleMapsUrl, formatTime } from "@/lib/utils";

// Screen 5 — Driver Dashboard (My Jobs).
export default function DriverJobsPage() {
  const jobs = getJobsForDriver(CURRENT_DRIVER_ID);

  return (
    <>
      <MobileHeader title="My Jobs" menu />

      <div className="shrink-0 flex border-b border-brand-ice/70 bg-white dark:bg-gray-900 dark:border-white/10">
        <button className="flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue">
          Today
        </button>
        <button className="flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-steel dark:text-gray-500">
          Upcoming
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface dark:bg-gray-950">
        {jobs.length === 0 ? (
          <EmptyState
            icon="check"
            title="You're all caught up"
            message="No jobs assigned for today."
          />
        ) : (
          jobs.map((job) => {
            const customer = getCustomer(job.customerId);
            const truck = job.assignedTruckId ? getTruck(job.assignedTruckId) : null;
            const dumpster = job.assignedDumpsterId
              ? getDumpster(job.assignedDumpsterId)
              : null;
            return (
              <div
                key={job.id}
                className="rounded-card bg-white dark:bg-gray-900 border border-brand-ice/70 dark:border-white/10 shadow-card overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-blue">
                        {formatTime(job.scheduledFor)}
                      </div>
                      <div className="font-semibold text-brand-charcoal dark:text-white mt-0.5">
                        {customer?.name}
                      </div>
                      <div className="text-sm text-brand-steel dark:text-gray-400 mt-0.5">
                        {job.address}
                      </div>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>

                  {/* At-a-glance load info so drivers don't open Details first */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-brand-steel dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="truck" width={14} height={14} />
                      {truck?.number ?? "No truck"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="dumpster" width={14} height={14} />
                      {dumpster ? `${dumpster.code} · ${job.dumpsterSize}` : job.dumpsterSize}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="jobs" width={14} height={14} />
                      {job.serviceType}
                    </span>
                  </div>

                  {/* Primary field action: navigate. Full-width, high emphasis. */}
                  <a
                    href={appleMapsUrl(job.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 h-12 rounded bg-brand-blue text-white font-heading font-semibold uppercase tracking-wide text-sm active:bg-brand-navy"
                  >
                    <Icon name="pin" width={18} height={18} />
                    Open in Apple Maps
                  </a>
                </div>

                <Link
                  href={`/driver/jobs/${job.id}`}
                  className="flex items-center justify-center gap-1.5 h-12 border-t border-brand-ice/50 dark:border-white/10 text-sm font-medium text-brand-blue active:bg-brand-mist dark:active:bg-white/5"
                >
                  <Icon name="info" width={16} height={16} />
                  View Details
                </Link>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
