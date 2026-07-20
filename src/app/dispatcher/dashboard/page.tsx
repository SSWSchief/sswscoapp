"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { CreateJobModal } from "@/components/dispatcher/CreateJobModal";
import { TodaysJobs } from "@/components/dispatcher/TodaysJobs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/Icon";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { getDashboardStats } from "@/lib/data";

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const stats = getDashboardStats();

  return (
    <>
      <Topbar
        title="Dashboard"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">New Job</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard value={stats.totalToday} label="Total Jobs" sublabel="Today" />
          <StatCard value={stats.inProgress} label="In Progress" tone="blue" />
          <StatCard value={stats.completed} label="Completed" tone="green" />
          <StatCard value={stats.pending} label="Pending" tone="amber" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <TodaysJobs />

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
                <Activity text="Job #1052 completed by Jake S." iso={activityIso(15)} />
                <Activity text="Job #1054 started by Mike R." iso={activityIso(32)} />
                <Activity text="New job #1055 created" iso={activityIso(45)} />
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

function activityIso(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function Glance({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Activity({ text, iso }: { text: string; iso: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
      <div>
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-xs text-gray-400">
          <RelativeTime iso={iso} />
        </p>
      </div>
    </li>
  );
}
