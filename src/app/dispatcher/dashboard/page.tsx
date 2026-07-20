"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { CreateJobModal } from "@/components/dispatcher/CreateJobModal";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import {
  getCustomer,
  getDashboardStats,
  getDumpster,
  getJobs,
  getTruck,
  getUser,
} from "@/lib/data";
import { formatTime } from "@/lib/utils";

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const stats = getDashboardStats();
  const jobs = getJobs();

  return (
    <>
      <Topbar
        title="Dashboard"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            New Job
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI tiles */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard value={stats.totalToday} label="Total Jobs" sublabel="Today" />
          <StatCard value={stats.inProgress} label="In Progress" tone="blue" />
          <StatCard value={stats.completed} label="Completed" tone="green" />
          <StatCard value={stats.pending} label="Pending" tone="amber" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Jobs */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Today's Jobs"
              action={
                <Link
                  href="/dispatcher/jobs"
                  className="text-sm font-medium text-brand-500 hover:underline"
                >
                  View all jobs →
                </Link>
              }
            />
            <Table>
              <THead>
                <TH>Time</TH>
                <TH>Customer</TH>
                <TH>Address</TH>
                <TH>Driver</TH>
                <TH>Truck</TH>
                <TH>Dumpster</TH>
                <TH>Status</TH>
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
                      <TD className="whitespace-nowrap font-medium text-gray-900">
                        {formatTime(job.scheduledFor)}
                      </TD>
                      <TD className="whitespace-nowrap">{customer?.name}</TD>
                      <TD className="text-gray-500 max-w-[180px] truncate">
                        {job.address}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {driver ? initials(driver.fullName) : "—"}
                      </TD>
                      <TD>{truck?.number ?? "—"}</TD>
                      <TD>{dumpster?.code ?? "—"}</TD>
                      <TD>
                        <JobStatusBadge status={job.status} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          {/* Right rail: At a Glance + Recent Activity */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="At a Glance" />
              <dl className="px-5 py-2 divide-y divide-gray-100">
                <Glance label="Drivers On Duty" value={stats.driversOnDuty} />
                <Glance label="Trucks In Use" value={stats.trucksInUse} />
                <Glance label="Dumpsters Out" value={stats.dumpstersOut} />
                <Glance label="Jobs Completed" value={stats.completed} />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Recent Activity" />
              <ul className="px-5 py-3 space-y-3">
                <Activity
                  text="Job #1052 completed by Jake S."
                  time="15m ago"
                />
                <Activity text="Job #1054 started by Mike R." time="32m ago" />
                <Activity text="New job #1055 created" time="45m ago" />
              </ul>
              <div className="px-5 pb-4">
                <Link
                  href="/dispatcher/jobs"
                  className="text-sm font-medium text-brand-500 hover:underline"
                >
                  View all activity →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function Glance({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Activity({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
      <div>
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-xs text-gray-400">{time}</p>
      </div>
    </li>
  );
}

function initials(name: string) {
  const [first, last] = name.split(" ");
  return `${first} ${last ? last[0] + "." : ""}`.trim();
}
