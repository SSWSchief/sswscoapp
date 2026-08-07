"use client";

import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useOperations } from "@/components/system/OperationsProvider";
import { formatTime } from "@/lib/utils";
import { PlatformMapLink } from "@/components/ui/PlatformMapLink";
import { driverJobsForWindow, type DriverJobWindow } from "@/lib/job-dates";
import { useState } from "react";

// Screen 5 — Driver Dashboard (My Jobs).
export default function DriverJobsPage() {
  const {
    jobs: allJobs,
    currentUser,
    customers,
    trucks,
    dumpsters,
  } = useOperations();
  const [window, setWindow] = useState<DriverJobWindow>("today");
  const jobs = driverJobsForWindow(allJobs, currentUser?.id ?? "", window);

  return (
    <>
      <MobileHeader title="My Jobs" />

      <div className="shrink-0 flex border-b border-brand-ice/70 bg-white dark:bg-gray-900 dark:border-white/10">
        <button
          onClick={() => setWindow("today")}
          aria-pressed={window === "today"}
          className={`flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide ${window === "today" ? "text-brand-blue border-b-2 border-brand-blue" : "text-brand-steel dark:text-gray-500"}`}
        >
          Today
        </button>
        <button
          onClick={() => setWindow("upcoming")}
          aria-pressed={window === "upcoming"}
          className={`flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide ${window === "upcoming" ? "text-brand-blue border-b-2 border-brand-blue" : "text-brand-steel dark:text-gray-500"}`}
        >
          Upcoming
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface dark:bg-gray-950">
        {jobs.length === 0 ? (
          <EmptyState
            icon="check"
            title="You're all caught up"
            message={
              window === "today"
                ? "No jobs assigned for today."
                : "No upcoming jobs assigned."
            }
          />
        ) : (
          jobs.map((job) => {
            const customer = customers.find(
              (item) => item.id === job.customerId,
            );
            const truck = job.assignedTruckId
              ? trucks.find((item) => item.id === job.assignedTruckId)
              : null;
            const dumpster = job.assignedDumpsterId
              ? dumpsters.find((item) => item.id === job.assignedDumpsterId)
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
                      {dumpster
                        ? `${dumpster.code} · ${job.dumpsterSize}`
                        : job.dumpsterSize}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="jobs" width={14} height={14} />
                      {job.serviceType}
                    </span>
                  </div>

                  {/* Primary field action: navigate. Full-width, high emphasis. */}
                  <PlatformMapLink
                    address={job.address}
                    className="mt-4 flex items-center justify-center gap-2 h-12 rounded bg-brand-blue text-white font-heading font-semibold uppercase tracking-wide text-sm active:bg-brand-navy"
                  >
                    <Icon name="pin" width={18} height={18} />
                    Navigate
                  </PlatformMapLink>
                </div>

                <Link
                  href={`/driver/jobs/${job.id}`}
                  className="flex items-center justify-center gap-1.5 h-12 border-t border-brand-ice/50 dark:border-white/10 text-sm font-medium text-brand-blue active:bg-brand-mist dark:active:bg-white/5"
                >
                  <Icon name="info" width={16} height={16} />
                  Open Job
                </Link>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
