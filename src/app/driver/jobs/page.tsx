import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { CURRENT_DRIVER_ID, getCustomer, getJobsForDriver } from "@/lib/data";
import { appleMapsUrl, formatTime } from "@/lib/utils";

// Screen 5 — Driver Dashboard (My Jobs).
export default function DriverJobsPage() {
  const jobs = getJobsForDriver(CURRENT_DRIVER_ID);

  return (
    <>
      <MobileHeader title="My Jobs" menu />

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-gray-200 bg-white">
        <button className="flex-1 py-3 text-sm font-medium text-brand-500 border-b-2 border-brand-500">
          Today
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-gray-400">
          Upcoming
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface">
        {jobs.map((job) => {
          const customer = getCustomer(job.customerId);
          return (
            <div
              key={job.id}
              className="rounded-card bg-white border border-gray-200 shadow-card overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-brand-500">
                      {formatTime(job.scheduledFor)}
                    </div>
                    <div className="font-semibold text-gray-900 mt-0.5">
                      {customer?.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {job.address}
                    </div>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 text-sm">
                <a
                  href={appleMapsUrl(job.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-3 text-brand-500 font-medium hover:bg-brand-50"
                >
                  <Icon name="pin" width={16} height={16} />
                  Open Map
                </a>
                <div className="flex items-center justify-center gap-1.5 py-3 text-gray-500">
                  <Icon name="clock" width={16} height={16} />
                  Start Job
                </div>
                <Link
                  href={`/driver/jobs/${job.id}`}
                  className="flex items-center justify-center gap-1.5 py-3 text-gray-500 hover:bg-gray-50"
                >
                  <Icon name="info" width={16} height={16} />
                  Details
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
