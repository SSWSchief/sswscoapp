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
import { useOperations } from "@/components/system/OperationsProvider";

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { jobs, activities, users, trucks, dumpsters } = useOperations();
  const stats = {
    enRoute: jobs.filter(job => job.status === "en_route").length,
    arrived: jobs.filter(job => job.status === "arrived").length,
    completed: jobs.filter(job => job.status === "complete").length,
    pending: jobs.filter(job => job.status === "pending").length,
    driversOnDuty: users.filter(user => user.role === "driver" && user.status === "active").length,
    trucksInUse: trucks.filter(truck => truck.status === "in_use").length,
    dumpstersOut: dumpsters.filter(dumpster => dumpster.status === "out").length,
  };
  const activity = activities.slice(0, 4);

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
          <StatCard value={stats.enRoute} label="En Route" tone="blue" />
          <StatCard value={stats.arrived} label="Arrived" tone="blue" />
          <StatCard value={stats.completed} label="Complete" tone="green" />
          <StatCard value={stats.pending} label="Pending" sublabel="Not Started" tone="amber" />
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
                <Glance label="Jobs Complete" value={stats.completed} />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Recent Activity" />
              <ul className="px-5 py-3 space-y-3">
                {activity.map((item) => (
                  <Activity key={item.id} text={item.body} iso={item.createdAt} />
                ))}
              </ul>
              <div className="px-5 pb-4">
                <Link
                  href="/dispatcher/jobs"
                  className="text-sm font-medium text-brand-blue hover:underline"
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
      <dt className="text-sm text-brand-steel">{label}</dt>
      <dd className="text-sm font-semibold text-brand-charcoal">{value}</dd>
    </div>
  );
}

function Activity({ text, iso }: { text: string; iso: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-blue shrink-0" />
      <div>
        <p className="text-sm text-brand-charcoal">{text}</p>
        <p className="text-xs text-brand-silver">
          <RelativeTime iso={iso} />
        </p>
      </div>
    </li>
  );
}
