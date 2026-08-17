"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/dispatcher/Topbar";
import { CreateJobModal } from "@/components/dispatcher/CreateJobModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { JobStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn, formatTime, jobStatusLabel } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";
import { useOperations } from "@/components/system/OperationsProvider";
import { jobsForPacificDay } from "@/lib/job-dates";
import { ListFooter } from "@/components/ui/ListFooter";

const filters: { label: string; value: JobStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "En Route", value: "en_route" },
  { label: "Arrived", value: "arrived" },
  { label: "Complete", value: "complete" },
];

type SortKey = "time" | "customer" | "status";
type StatusFilter = JobStatus | "all" | "active";

export default function JobsPage() {
  return (
    <React.Suspense fallback={<JobsPageShell />}>
      <JobsPageContent />
    </React.Suspense>
  );
}

function JobsPageContent() {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const initialStatus =
    searchParams.get("status") === "active"
      ? "active"
      : filters.some((item) => item.value === searchParams.get("status"))
        ? (searchParams.get("status") as JobStatus)
        : "all";
  const [filter, setFilter] = React.useState<StatusFilter>(initialStatus);
  const [sort, setSort] = React.useState<SortKey>("time");
  const {
    jobs: allJobs,
    customers,
    dumpsters,
    trucks,
    users,
    totals,
  } = useOperations();
  const todayOnly =
    searchParams.get("window") === "today" ||
    searchParams.get("queue") === "unassigned";
  const unassignedOnly = searchParams.get("queue") === "unassigned";

  const jobs = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = todayOnly ? jobsForPacificDay(allJobs) : allJobs;
    let list = source.filter((j) => {
      if (filter === "active" && !["en_route", "arrived"].includes(j.status))
        return false;
      if (filter !== "all" && filter !== "active" && j.status !== filter)
        return false;
      if (unassignedOnly && j.assignedDriverId) return false;
      if (!q) return true;
      const customer = customers.find((item) => item.id === j.customerId);
      return `${j.reference} ${customer?.name ?? ""} ${j.address}`
        .toLowerCase()
        .includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === "time") return a.scheduledFor.localeCompare(b.scheduledFor);
      if (sort === "status") return a.status.localeCompare(b.status);
      const ca = customers.find((item) => item.id === a.customerId)?.name ?? "";
      const cb = customers.find((item) => item.id === b.customerId)?.name ?? "";
      return ca.localeCompare(cb);
    });
    return list;
  }, [allJobs, customers, query, filter, sort, todayOnly, unassignedOnly]);

  return (
    <>
      <Topbar
        title="Jobs"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">New Job</span>
          </Button>
        }
      />

      <div className="portal-content">
        <Card>
          <div className="flex flex-col gap-3 p-4 sm:p-5 border-b border-brand-ice/60">
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by job #, customer, or address…"
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "min-h-11 px-3 rounded font-heading text-sm font-medium uppercase tracking-wide transition-colors",
                    filter === f.value
                      ? "bg-brand-blue text-white"
                      : "text-brand-steel border border-brand-ice hover:bg-brand-mist",
                  )}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setFilter("active")}
                className={cn(
                  "min-h-11 px-3 rounded font-heading text-sm font-medium uppercase tracking-wide transition-colors",
                  filter === "active"
                    ? "bg-brand-blue text-white"
                    : "text-brand-steel border border-brand-ice hover:bg-brand-mist",
                )}
              >
                Active
              </button>
              <div className="ml-auto flex items-center gap-2 text-sm text-brand-steel">
                <label htmlFor="sort">Sort</label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="min-h-11 rounded border border-brand-ice px-2 text-base text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-skyline/40 sm:text-sm"
                >
                  <option value="time">Time</option>
                  <option value="customer">Customer</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              icon="search"
              title="No jobs match your filters"
              message="Try a different search term or clear the status filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TH>Job</TH>
                    <TH>Time</TH>
                    <TH>Customer</TH>
                    <TH>Driver</TH>
                    <TH>Truck</TH>
                    <TH>Dumpster</TH>
                    <TH>Status</TH>
                    <TH />
                  </THead>
                  <TBody>
                    {jobs.map((job) => {
                      const customer = customers.find(
                        (item) => item.id === job.customerId,
                      );
                      const driver = job.assignedDriverId
                        ? users.find((item) => item.id === job.assignedDriverId)
                        : null;
                      const truck = job.assignedTruckId
                        ? trucks.find((item) => item.id === job.assignedTruckId)
                        : null;
                      const dumpster = job.assignedDumpsterId
                        ? dumpsters.find(
                            (item) => item.id === job.assignedDumpsterId,
                          )
                        : null;
                      return (
                        <TR key={job.id}>
                          <TD className="font-semibold text-brand-charcoal">
                            {job.reference}
                          </TD>
                          <TD className="whitespace-nowrap">
                            {formatTime(job.scheduledFor)}
                          </TD>
                          <TD className="whitespace-nowrap">
                            {customer?.name}
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
                              className="text-brand-blue hover:underline text-sm font-medium"
                            >
                              View
                            </Link>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-brand-ice/50">
                {jobs.map((job) => {
                  const customer = customers.find(
                    (item) => item.id === job.customerId,
                  );
                  const driver = job.assignedDriverId
                    ? users.find((item) => item.id === job.assignedDriverId)
                    : null;
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/dispatcher/jobs/${job.id}`}
                        className="flex items-start justify-between gap-3 p-4 hover:bg-brand-mist/70"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-brand-charcoal">
                              {job.reference}
                            </span>
                            <span className="text-xs text-brand-silver">
                              {formatTime(job.scheduledFor)}
                            </span>
                          </div>
                          <div className="text-sm text-brand-charcoal mt-0.5">
                            {customer?.name}
                          </div>
                          <div className="text-xs text-brand-silver truncate">
                            {job.address}
                          </div>
                          <div className="text-xs text-brand-steel mt-1">
                            {driver?.fullName ?? "Unassigned"}
                          </div>
                        </div>
                        <JobStatusBadge status={job.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/*
            The loaded set is a window around today, not the whole history, so
            the footer says which span it covers — otherwise an owner looking
            for last quarter's job would read its absence as data loss.
          */}
          <ListFooter
            shown={jobs.length}
            loaded={allJobs.length}
            total={totals.jobs}
            noun="jobs"
            note={
              <>
                {filter !== "all" &&
                  `${jobStatusLabel[filter as JobStatus]} · `}
                last 30 days through next 90. Older work is in Reports.
              </>
            }
          />
        </Card>
      </div>

      <CreateJobModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function JobsPageShell() {
  return (
    <>
      <Topbar title="Jobs" />
      <div className="portal-content">
        <Card className="p-6 text-sm text-brand-steel">Loading jobs…</Card>
      </div>
    </>
  );
}
