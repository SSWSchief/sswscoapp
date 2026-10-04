"use client";

import * as React from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { CostSettingsPanel } from "@/components/management/CostSettingsPanel";
import { JobCostModal } from "@/components/management/JobCostModal";
import {
  byCustomer,
  byMonth,
  bySize,
  fromResultRow,
  inPeriod,
  totals,
  unbilledInPeriod,
  type CostSource,
  type DateBasis,
  type ProfitRow,
  type Totals,
} from "@/lib/billing/profitability";
import { downloadPdf, downloadXlsx } from "@/lib/client-download";
import { effectivePermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { pacificDate } from "@/lib/time-clock";
import { cn, formatCurrency } from "@/lib/utils";

type Preset = "this-month" | "last-month" | "this-quarter" | "year" | "custom";

/** Date range for a preset, in company (Las Vegas) dates. */
function presetRange(preset: Exclude<Preset, "custom">, today: string) {
  const [year, month] = today.split("-").map(Number);
  const pad = (value: number) => String(value).padStart(2, "0");
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (preset === "this-month") return { from: `${year}-${pad(month)}-01`, to: today };
  if (preset === "last-month") {
    const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1];
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  }
  if (preset === "this-quarter") return { from: `${year}-${pad(Math.floor((month - 1) / 3) * 3 + 1)}-01`, to: today };
  return { from: `${year}-01-01`, to: today };
}

const percent = (margin: number) => `${(margin * 100).toFixed(1)}%`;

function Amount({ cents, source }: { cents: number | null; source: CostSource | null }) {
  if (cents === null) return <span className="text-amber-700">Missing</span>;
  return (
    <span title={source === "estimated" ? "Estimated" : "Actual"}>
      {formatCurrency(cents)}
      {source === "estimated" && <span className="ml-1 text-xs text-brand-steel">est.</span>}
    </span>
  );
}

/**
 * Job profitability, management only: Austin's Operations Dashboard workbook
 * built from what Overwatch already records. Revenue counts when invoiced by
 * default (Austin, 2026-09-30) and is split into received and still owed;
 * costs are the driver's landfill charge, fuel from the miles run, and labor.
 */
export default function ProfitabilityPage() {
  const { currentUser } = useOperations();
  const { toast } = useToast();
  const allowed = currentUser ? effectivePermissions(currentUser).profitability : false;
  const today = pacificDate(new Date());
  const [preset, setPreset] = React.useState<Preset>("this-month");
  const [range, setRange] = React.useState(() => presetRange("this-month", today));
  const [basis, setBasis] = React.useState<DateBasis>("invoiced");
  const [rows, setRows] = React.useState<ProfitRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [editing, setEditing] = React.useState<ProfitRow | null>(null);
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  const invalid = range.from > range.to;

  React.useEffect(() => {
    if (!allowed || invalid) return;
    let cancelled = false;
    setRows(null);
    setError(false);
    void createClient()
      .rpc("profitability_rows", { from_date: range.from, through_date: range.to })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(true);
        else setRows((data ?? []).map(fromResultRow));
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, invalid, range.from, range.to, revision]);

  const reload = () => setRevision((value) => value + 1);
  const shown = rows ? inPeriod(rows, range.from, range.to, basis) : [];
  const sum = totals(shown);
  const unbilled = rows && basis === "invoiced" ? unbilledInPeriod(rows, range.from, range.to) : [];

  const choosePreset = (next: Preset) => {
    setPreset(next);
    if (next !== "custom") setRange(presetRange(next, today));
  };

  const download = async (format: "xlsx" | "pdf") => {
    const name = `profitability-${range.from}-${range.to}.${format}`;
    const url = `/api/exports/profitability?from=${range.from}&to=${range.to}&basis=${basis}&format=${format}`;
    setDownloading(format);
    try {
      if (format === "xlsx") await downloadXlsx(url, name);
      else await downloadPdf(url, name);
      toast(`Profitability ${format === "xlsx" ? "Excel file" : "PDF"} downloaded.`, { tone: "success" });
    } catch (downloadError) {
      toast(downloadError instanceof Error ? downloadError.message : "The report could not be downloaded.", { tone: "error" });
    } finally {
      setDownloading(null);
    }
  };

  if (currentUser && !allowed)
    return (
      <>
        <Topbar title="Profitability" />
        <div className="portal-content"><Card className="p-5 text-sm text-brand-steel">Profitability is for management only.</Card></div>
      </>
    );

  return (
    <>
      <Topbar title="Profitability" />
      <div className="portal-content portal-stack">
        <Card className="grid gap-4 p-4 sm:grid-cols-4">
          <label className="text-sm">
            Period
            <Select value={preset} onChange={(event) => choosePreset(event.target.value as Preset)}>
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="this-quarter">This quarter</option>
              <option value="year">Year to date</option>
              <option value="custom">Custom</option>
            </Select>
          </label>
          <label className="text-sm">
            From
            <Input type="date" value={range.from} onChange={(event) => { setPreset("custom"); setRange((current) => ({ ...current, from: event.target.value })); }} />
          </label>
          <label className="text-sm">
            Through
            <Input type="date" value={range.to} onChange={(event) => { setPreset("custom"); setRange((current) => ({ ...current, to: event.target.value })); }} />
          </label>
          <label className="text-sm">
            Count revenue by
            <Select value={basis} onChange={(event) => setBasis(event.target.value as DateBasis)}>
              <option value="invoiced">Invoice date</option>
              <option value="completed">Completion date</option>
            </Select>
          </label>
          {invalid && <p className="text-sm text-red-600 sm:col-span-4">From date must be before the through date.</p>}
        </Card>

        {error ? (
          <Card className="p-5 text-sm text-red-600">The profitability figures could not be loaded.</Card>
        ) : (
          <>
            <div className="portal-metric-grid">
              <Metric label="Revenue" value={rows ? formatCurrency(sum.revenueCents) : "…"} />
              <Metric label="Received" value={rows ? formatCurrency(sum.receivedCents) : "…"} />
              <Metric label="Still owed" value={rows ? formatCurrency(sum.outstandingCents) : "…"} />
              <Metric label="Expenses" value={rows ? formatCurrency(sum.expensesCents) : "…"} />
              <Metric label="Profit" value={rows ? formatCurrency(sum.profitCents) : "…"} tone={sum.profitCents < 0 ? "text-red-600" : undefined} />
              <Metric label="Margin" value={rows ? percent(sum.margin) : "…"} />
            </div>
            {rows && (sum.incompleteJobs > 0 || unbilled.length > 0) && (
              <Card className="p-4 text-sm text-amber-800">
                {sum.incompleteJobs > 0 && <p>{sum.incompleteJobs} job{sum.incompleteJobs === 1 ? " is" : "s are"} missing a dump fee, fuel or labor figure, so profit is overstated until they&apos;re filled in.</p>}
                {unbilled.length > 0 && <p>{unbilled.length} job{unbilled.length === 1 ? "" : "s"} completed in this period {unbilled.length === 1 ? "hasn't" : "haven't"} been invoiced yet.</p>}
              </Card>
            )}

            <Card>
              <CardHeader
                title={`Jobs (${shown.length})`}
                action={
                  <div className="flex gap-2">
                    <Button disabled={downloading !== null || invalid} onClick={() => void download("xlsx")}>{downloading === "xlsx" ? "Downloading…" : "Excel"}</Button>
                    <Button variant="secondary" disabled={downloading !== null || invalid} onClick={() => void download("pdf")}>{downloading === "pdf" ? "Downloading…" : "PDF"}</Button>
                  </div>
                }
              />
              {!rows ? (
                <p className="px-5 py-4 text-sm text-brand-steel">Loading…</p>
              ) : shown.length === 0 ? (
                <p className="px-5 py-4 text-sm text-brand-steel">No {basis === "invoiced" ? "invoiced" : "completed"} jobs in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TH>Job</TH>
                      <TH>Customer</TH>
                      <TH>Size</TH>
                      <TH>Revenue</TH>
                      <TH>Dump fee</TH>
                      <TH>Fuel</TH>
                      <TH>Labor</TH>
                      <TH>Other</TH>
                      <TH>Profit</TH>
                      <TH />
                    </THead>
                    <TBody>
                      {shown.map((row) => {
                        const profit = row.revenueCents - (row.dumpFeeCents ?? 0) - (row.fuelCents ?? 0) - (row.laborCents ?? 0) - row.otherCents;
                        return (
                          <TR key={row.jobId}>
                            <TD className="whitespace-nowrap font-semibold">
                              <Link href={`/dispatcher/jobs/${row.jobId}`} className="text-brand-blue hover:underline">{row.reference}</Link>
                              <span className="block text-xs font-normal text-brand-steel">{pacificDate(row.completedAt)}</span>
                            </TD>
                            <TD>{row.customerName}</TD>
                            <TD className="whitespace-nowrap">{row.dumpsterSize}</TD>
                            <TD>
                              {formatCurrency(row.revenueCents)}
                              {row.revenueCents > row.receivedCents && <span className="block text-xs text-brand-steel">{formatCurrency(row.revenueCents - row.receivedCents)} owed</span>}
                            </TD>
                            <TD><Amount cents={row.dumpFeeCents} source={row.dumpSource} /></TD>
                            <TD><Amount cents={row.fuelCents} source={row.fuelSource} /></TD>
                            <TD><Amount cents={row.laborCents} source={row.laborSource} /></TD>
                            <TD>{formatCurrency(row.otherCents)}</TD>
                            <TD className={cn("font-semibold", profit < 0 && "text-red-600")}>
                              {formatCurrency(profit)}
                              {row.revenueCents > 0 && <span className="block text-xs font-normal text-brand-steel">{percent(profit / row.revenueCents)}</span>}
                            </TD>
                            <TD><button type="button" className="text-sm font-medium text-brand-blue hover:underline" onClick={() => setEditing(row)}>Costs</button></TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
              )}
            </Card>

            {rows && shown.length > 0 && (
              <div className="grid gap-5 lg:grid-cols-3">
                <Rollup title="By month" groups={byMonth(shown, basis)} />
                <Rollup title="By customer" groups={byCustomer(shown)} />
                <Rollup title="By dumpster size" groups={bySize(shown)} />
              </div>
            )}
          </>
        )}

        <CostSettingsPanel onSaved={reload} />
      </div>
      <JobCostModal row={editing} userId={currentUser?.id ?? null} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="portal-card-pad">
      <div className={cn("font-heading text-2xl font-bold min-[390px]:text-3xl", tone)}>{value}</div>
      <div className="text-sm uppercase text-brand-steel">{label}</div>
    </Card>
  );
}

function Rollup({ title, groups }: { title: string; groups: Map<string, Totals> }) {
  return (
    <Card>
      <CardHeader title={title} />
      <dl className="divide-y divide-brand-ice/60 px-5 py-2 text-sm">
        {[...groups].map(([key, group]) => (
          <div key={key} className="flex items-center justify-between gap-3 py-2">
            <dt className="truncate">{key}<span className="ml-1 text-xs text-brand-steel">· {group.jobs} job{group.jobs === 1 ? "" : "s"}</span></dt>
            <dd className={cn("whitespace-nowrap font-semibold", group.profitCents < 0 && "text-red-600")}>
              {formatCurrency(group.profitCents)} <span className="text-xs font-normal text-brand-steel">{percent(group.margin)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
