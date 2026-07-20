import { notFound } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { getCustomer, getJob } from "@/lib/data";
import { appleMapsUrl } from "@/lib/utils";

// Screen 6 — Driver Job Details.
export default function DriverJobDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const job = getJob(params.id);
  if (!job) notFound();
  const customer = getCustomer(job.customerId);

  return (
    <>
      <MobileHeader title={`Job ${job.reference}`} back="/driver/jobs" />

      <div className="flex-1 overflow-y-auto bg-surface">
        {/* Customer + address */}
        <div className="bg-white p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{customer?.name}</h2>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{job.address}</p>

          <a
            href={appleMapsUrl(job.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-2 h-11 rounded-lg border border-brand/30 text-brand-500 font-medium text-sm hover:bg-brand-50"
          >
            <Icon name="pin" width={18} height={18} />
            Open in Apple Maps
          </a>
        </div>

        {/* Job Information */}
        <div className="bg-white mt-3 p-4 border-y border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Job Information
          </h3>
          <dl className="space-y-3 text-sm">
            <Info label="Dumpster Size" value={job.dumpsterSize} />
            <Info label="Service Type" value={job.serviceType} />
            <Info label="Notes" value={job.notes || "—"} />
          </dl>
        </div>

        {/* Photos placeholder */}
        <div className="bg-white mt-3 p-4 border-y border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Photos</h3>
          <div className="flex gap-3">
            {job.photos.length ? (
              job.photos.map((p) => (
                <div
                  key={p.id}
                  className="h-16 w-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300"
                >
                  <Icon name="photo" width={22} height={22} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No photos yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons pinned above bottom nav */}
      <div className="shrink-0 bg-white border-t border-gray-100 p-4 space-y-3">
        <button className="w-full h-11 rounded-lg bg-status-complete text-white font-medium text-sm">
          Start Job
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button className="h-11 rounded-lg border border-brand/30 text-brand-500 font-medium text-sm flex items-center justify-center gap-1.5">
            <Icon name="photo" width={16} height={16} />
            Add Photo
          </button>
          <button className="h-11 rounded-lg border border-brand/30 text-brand-500 font-medium text-sm flex items-center justify-center gap-1.5">
            <Icon name="edit" width={16} height={16} />
            Add Note
          </button>
        </div>
        <button className="w-full h-11 rounded-lg border border-red-200 text-red-500 font-medium text-sm">
          Complete Job
        </button>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-800 text-right font-medium">{value}</dd>
    </div>
  );
}
