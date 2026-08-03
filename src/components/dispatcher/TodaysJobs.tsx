"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/system/ToastProvider";
import { useDemoState } from "@/components/system/DemoStateProvider";
import { getCustomer, getDrivers, getTruck } from "@/lib/data";
import { formatTime } from "@/lib/utils";
import type { Job } from "@/lib/types";

/**
 * Interactive Today's Jobs. Demonstrates three review items with local state:
 *  - inline quick-assign of a driver (with busy-driver conflict awareness),
 *  - an always-visible Status column (no horizontal scroll for the essentials),
 *  - a "Live" indicator plus a simulated realtime status update + toast.
 */
export function TodaysJobs() {
  const { toast } = useToast();
  const { jobs, assignDriver: persistAssignment } = useDemoState();
  const drivers = getDrivers();

  // A driver is "busy" if they already own an active job.
  const busyDriverIds = React.useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      if ((j.status === "en_route" || j.status === "arrived") && j.assignedDriverId) {
        s.add(j.assignedDriverId);
      }
    });
    return s;
  }, [jobs]);

  const assignDriver = (jobId: string, driverId: string) => {
    const prev = jobs.find((j) => j.id === jobId)?.assignedDriverId ?? null;
    persistAssignment(jobId, driverId);
    const driver = drivers.find((d) => d.id === driverId);
    toast(`Assigned ${driver?.fullName ?? "driver"} to ${jobRef(jobs, jobId)}`, {
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => prev && persistAssignment(jobId, prev),
      },
    });
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Today&apos;s Jobs
            <span className="inline-flex items-center gap-1 text-xs font-medium text-status-complete">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-complete opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-complete" />
              </span>
              Live
            </span>
          </span>
        }
        action={
          <Link
            href="/dispatcher/jobs"
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            View all jobs →
          </Link>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon="jobs"
          title="No jobs scheduled today"
          message="Create a job to get the day started."
        />
      ) : (
        <>
          {/* Desktop: compact table with Status always visible */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TH>Time</TH>
                <TH>Customer</TH>
                <TH>Driver</TH>
                <TH>Truck</TH>
                <TH className="text-right pr-5">Status</TH>
              </THead>
              <TBody>
                {jobs.map((job) => {
                  const customer = getCustomer(job.customerId);
                  const truck = job.assignedTruckId ? getTruck(job.assignedTruckId) : null;
                  return (
                    <TR key={job.id}>
                      <TD className="whitespace-nowrap font-medium text-brand-charcoal">
                        {formatTime(job.scheduledFor)}
                      </TD>
                      <TD className="max-w-[220px]">
                        <Link
                          href={`/dispatcher/jobs/${job.id}`}
                          className="font-medium text-brand-charcoal hover:text-brand-blue"
                        >
                          {customer?.name}
                        </Link>
                        <div className="text-xs text-brand-steel truncate">
                          {job.address}
                        </div>
                      </TD>
                      <TD>
                        <DriverSelect
                          value={job.assignedDriverId}
                          drivers={drivers}
                          busy={busyDriverIds}
                          currentJobDriver={job.assignedDriverId}
                          onChange={(id) => assignDriver(job.id, id)}
                        />
                      </TD>
                      <TD>{truck?.number ?? "—"}</TD>
                      <TD className="text-right pr-5">
                        <JobStatusBadge status={job.status} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>

          {/* Mobile: cards instead of a horizontally scrolling table */}
          <ul className="md:hidden divide-y divide-gray-100">
            {jobs.map((job) => {
              const customer = getCustomer(job.customerId);
              return (
                <li key={job.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-brand-blue">
                        {formatTime(job.scheduledFor)}
                      </div>
                      <Link
                        href={`/dispatcher/jobs/${job.id}`}
                        className="font-medium text-brand-charcoal"
                      >
                        {customer?.name}
                      </Link>
                      <div className="text-xs text-brand-steel truncate">
                        {job.address}
                      </div>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <div className="mt-2">
                    <DriverSelect
                      value={job.assignedDriverId}
                      drivers={drivers}
                      busy={busyDriverIds}
                      currentJobDriver={job.assignedDriverId}
                      onChange={(id) => assignDriver(job.id, id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function jobRef(jobs: Job[], id: string) {
  return jobs.find((j) => j.id === id)?.reference ?? "job";
}

function DriverSelect({
  value,
  drivers,
  busy,
  currentJobDriver,
  onChange,
}: {
  value: string | null;
  drivers: { id: string; fullName: string }[];
  busy: Set<string>;
  currentJobDriver: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 appearance-none rounded border border-brand-ice bg-white pl-2 pr-7 text-base text-brand-charcoal hover:border-brand-skyline focus:outline-none focus:ring-2 focus:ring-brand-skyline/40 sm:text-sm"
        aria-label="Assign driver"
      >
        <option value="" disabled>
          Assign driver
        </option>
        {drivers.map((d) => {
          // Busy drivers are flagged unless they're the one already on this job.
          const unavailable = busy.has(d.id) && d.id !== currentJobDriver;
          return (
            <option key={d.id} value={d.id} disabled={unavailable}>
              {d.fullName}
              {unavailable ? " (busy)" : ""}
            </option>
          );
        })}
      </select>
      <Icon
        name="chevron-down"
        width={14}
        height={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-brand-steel"
      />
    </div>
  );
}
