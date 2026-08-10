"use client";

import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { jobsForPacificDay } from "@/lib/job-dates";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function Page() {
  const { jobs, trucks, dumpsters, timeRequests, users } = useOperations();
  const { invoices, pretripSubmissions } = useExpandedOperations();
  const today = jobsForPacificDay(jobs);
  const receivables = invoices
    .filter((invoice) => !["paid", "closed", "void"].includes(invoice.status))
    .reduce((total, invoice) => total + invoice.amountCents, 0);
  const activeJobs = today.filter((job) =>
    ["en_route", "arrived"].includes(job.status),
  );
  const availableAssets =
    trucks.filter((truck) => truck.status === "in_use" && !truck.currentJobId)
      .length +
    dumpsters.filter((dumpster) => dumpster.status === "in_yard").length;

  const metrics = [
    {
      label: "Jobs Today",
      value: today.length,
      href: "/dispatcher/jobs?window=today",
    },
    {
      label: "Active Jobs",
      value: activeJobs.length,
      href: "/dispatcher/jobs?status=active",
    },
    {
      label: "Receivables",
      value: currency.format(receivables / 100),
      href: "/dispatcher/invoices",
    },
    {
      label: "Available Assets",
      value: availableAssets,
      href: "/dispatcher/map",
    },
  ];
  const exceptions = [
    {
      label: "Unassigned jobs",
      value: today.filter((job) => !job.assignedDriverId).length,
      href: "/dispatcher/jobs?queue=unassigned",
    },
    {
      label: "Pending time requests",
      value: timeRequests.filter((request) => request.status === "pending")
        .length,
      href: "/dispatcher/time-clock",
    },
    {
      label: "Failed pre-trips",
      value: pretripSubmissions.filter((submission) => submission.hasFailures)
        .length,
      href: "/dispatcher/reports",
    },
    {
      label: "Inactive employees",
      value: users.filter((user) => user.status === "inactive").length,
      href: "/dispatcher/employees",
    },
  ];

  return (
    <>
      <Topbar title="Management Overview" />
      <div className="portal-content portal-stack">
        <Card className="portal-card-pad">
          <p className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-blue">
            Administrator oversight
          </p>
          <p className="mt-1 text-sm text-brand-steel">
            Live operational metrics, exceptions, and administrative tools.
          </p>
        </Card>

        <div className="portal-metric-grid">
          {metrics.map((metric) => (
            <MetricLink key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Exceptions" />
            <div className="divide-y divide-brand-ice">
              {exceptions.map((exception) => (
                <ExceptionLink key={exception.label} {...exception} />
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Admin Tools" />
            <div className="portal-action-grid p-4">
              {[
                ["Operations Workspace", "/dispatcher/dashboard"],
                ["Invoices", "/dispatcher/invoices"],
                ["Reports", "/dispatcher/reports"],
                ["Settings", "/dispatcher/settings"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-h-14 items-center justify-center rounded border border-brand-blue px-3 text-center font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function MetricLink({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`Open ${label}`}
      className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
    >
      <Card className="portal-card-pad transition-colors hover:border-brand-blue hover:bg-white">
        <div className="font-heading text-2xl font-bold min-[390px]:text-3xl">
          {value}
        </div>
        <div className="text-sm uppercase text-brand-steel">{label}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-blue">
          View details →
        </div>
      </Card>
    </Link>
  );
}

function ExceptionLink({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 justify-between p-4 transition-colors hover:bg-brand-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue"
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
