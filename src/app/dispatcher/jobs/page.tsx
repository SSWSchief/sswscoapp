"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { CreateJobModal } from "@/components/dispatcher/CreateJobModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import {
  getCustomer,
  getDumpster,
  getJobs,
  getTruck,
  getUser,
} from "@/lib/data";
import { formatTime } from "@/lib/utils";

export default function JobsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const jobs = getJobs();

  return (
    <>
      <Topbar
        title="Jobs"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            New Job
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 p-5 border-b border-gray-100">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                width={18}
                height={18}
              />
              <Input placeholder="Search jobs..." className="pl-10" />
            </div>
            <div className="flex gap-2">
              {["All", "In Progress", "Pending", "Completed"].map((f, i) => (
                <button
                  key={f}
                  className={
                    i === 0
                      ? "h-10 px-3 rounded-lg text-sm font-medium bg-brand text-white"
                      : "h-10 px-3 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <Table>
            <THead>
              <TH>Job</TH>
              <TH>Time</TH>
              <TH>Customer</TH>
              <TH>Address</TH>
              <TH>Driver</TH>
              <TH>Truck</TH>
              <TH>Dumpster</TH>
              <TH>Status</TH>
              <TH />
            </THead>
            <TBody>
              {jobs.map((job) => {
                const customer = getCustomer(job.customerId);
                const driver = job.assignedDriverId
                  ? getUser(job.assignedDriverId)
                  : null;
                const truck = job.assignedTruckId
                  ? getTruck(job.assignedTruckId)
                  : null;
                const dumpster = job.assignedDumpsterId
                  ? getDumpster(job.assignedDumpsterId)
                  : null;
                return (
                  <TR key={job.id}>
                    <TD className="font-semibold text-gray-900">
                      {job.reference}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {formatTime(job.scheduledFor)}
                    </TD>
                    <TD className="whitespace-nowrap">{customer?.name}</TD>
                    <TD className="text-gray-500 max-w-[200px] truncate">
                      {job.address}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {driver?.fullName ?? "—"}
                    </TD>
                    <TD>{truck?.number ?? "—"}</TD>
                    <TD>{dumpster?.code ?? "—"}</TD>
                    <TD>
                      <JobStatusBadge status={job.status} />
                    </TD>
                    <TD>
                      <Link
                        href={`/dispatcher/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 text-brand-500 hover:underline text-sm font-medium"
                      >
                        View
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <div className="flex items-center justify-between px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
            <span>Showing {jobs.length} of {jobs.length} jobs</span>
          </div>
        </Card>
      </div>

      <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
