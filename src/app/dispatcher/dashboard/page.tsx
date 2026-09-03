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
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { jobsForPacificDay } from "@/lib/job-dates";

export default function DashboardPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { jobs, activities, users, trucks, dumpsters, timeRequests } =
    useOperations();
  const { pretripSubmissions, invoices } = useExpandedOperations();
  const todaysJobs = jobsForPacificDay(jobs);
  const unassignedJobs = todaysJobs.filter(
    (job) => !job.assignedDriverId && job.status === "pending",
  ).length;
  const activeJobs = todaysJobs.filter((job) =>
    ["en_route", "arrived"].includes(job.status),
  ).length;
  const failedPretrips = pretripSubmissions.filter(
    (submission) => submission.hasFailures,
  ).length;
  const pendingTimeRequests = timeRequests.filter(
    (request) => request.status === "pending",
  ).length;
  const openReceivables = invoices.filter(
    (invoice) => !["paid", "void"].includes(invoice.status),
  ).length;
  const stats = {
    enRoute: todaysJobs.filter((job) => job.status === "en_route").length,
    arrived: todaysJobs.filter((job) => job.status === "arrived").length,
    completed: todaysJobs.filter((job) => job.status === "complete").length,
    pending: todaysJobs.filter((job) => job.status === "pending").length,
    driversOnDuty: users.filter(
      (user) => user.role === "driver" && user.status === "active",
    ).length,
    trucksInUse: trucks.filter((truck) => truck.status === "in_use").length,
    dumpstersOut: dumpsters.filter((dumpster) => dumpster.status === "out")
      .length,
  };
  const activity = activities.slice(0, 4);

  return (
    <>
      <Topbar
        title="Operations Overview"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">New Job</span>
          </Button>
        }
      />

      <div className="portal-content portal-stack">
        <Card>
          <CardHeader title="Needs Attention" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <AttentionLink
              label="Unassigned Jobs"
              value={unassignedJobs}
              href="/dispatcher/jobs?queue=unassigned"
              tone={unassignedJobs ? "urgent" : "clear"}
            />
            <AttentionLink
              label="Active Jobs"
              value={activeJobs}
              href="/dispatcher/jobs?status=active"
              tone="normal"
            />
            <AttentionLink
              label="Time Requests"
              value={pendingTimeRequests}
              href="/dispatcher/time-clock"
              tone={pendingTimeRequests ? "urgent" : "clear"}
            />
            <AttentionLink
              label="Failed Pre-Trips"
              value={failedPretrips}
              href="/dispatcher/reports"
              tone={failedPretrips ? "urgent" : "clear"}
            />
            <AttentionLink
              label="Open Invoices"
              value={openReceivables}
              href="/dispatcher/invoices"
              tone="normal"
            />
          </div>
        </Card>

        <div className="portal-metric-grid">
          <StatCard value={stats.enRoute} label="En Route" tone="blue" />
          <StatCard value={stats.arrived} label="Arrived" tone="blue" />
          <StatCard value={stats.completed} label="Complete" tone="green" />
          <StatCard
            value={stats.pending}
            label="Pending"
            sublabel="Not Started"
            tone="amber"
          />
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
                  <Activity
                    key={item.id}
                    text={item.body}
                    iso={item.createdAt}
                  />
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

function AttentionLink({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "urgent" | "normal" | "clear";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : tone === "clear"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-brand-ice bg-white text-brand-charcoal";
  return (
    <Link
      href={href}
      className={`rounded border p-3 transition-colors hover:border-brand-blue hover:bg-brand-mist ${toneClass}`}
    >
      <div className="font-heading text-2xl font-bold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-2 text-xs text-brand-blue">Open →</div>
    </Link>
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
