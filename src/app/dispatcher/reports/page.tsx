"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { downloadCsv, downloadPdf, downloadXlsx } from "@/lib/client-download";
import { pacificDate } from "@/lib/time-clock";
import { loadedJobWindow } from "@/lib/job-dates";

const reportCards = [
  [
    "Operations",
    "Date-filtered jobs, status, assignment, and service data.",
    "jobs",
  ],
  [
    "Employee Time",
    "Daily clock timestamps, unpaid breaks, and calculated worked hours.",
    "time",
  ],
  [
    "Asset Utilization",
    "Truck, dumpster, location, status, and AirTag records.",
    "assets",
  ],
  [
    "Invoice Records",
    "Manual invoice lifecycle and receivable records.",
    "invoices",
  ],
] as const;

export default function Page() {
  const { jobs, trucks, dumpsters, canMutate } = useOperations();
  const { invoices } = useExpandedOperations();
  const { toast } = useToast();
  const [from, setFrom] = React.useState(() =>
    pacificDate(new Date(Date.now() - 6 * 86400000)),
  );
  const [to, setTo] = React.useState(() => pacificDate(new Date()));
  const [downloading, setDownloading] = React.useState<string | null>(null);
  const invalidRange = from > to;
  const loadedFrom = pacificDate(loadedJobWindow().start);
  const reachesPastLoaded = from < loadedFrom;
  const selected = jobs.filter((j) => {
    const d = pacificDate(j.scheduledFor);
    return d >= from && d <= to;
  });
  const revenue = invoices
    .filter((i) => i.dueDate !== null && i.dueDate >= from && i.dueDate <= to)
    .reduce((n, i) => n + i.amountCents, 0);
  const href = (type: string) =>
    `/api/exports/${type}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const download = async (type: string, title: string, format: "xlsx" | "csv" | "pdf") => {
    if (invalidRange) {
      toast("Choose a From date before the Through date.", { tone: "error" });
      return;
    }
    setDownloading(`${type}:${format}`);
    try {
      if (format === "pdf") await downloadPdf(`${href(type)}&format=pdf`, `${type}-${from}-${to}.pdf`);
      else if (format === "xlsx") await downloadXlsx(`${href(type)}&format=xlsx`, `${type}-${from}-${to}.xlsx`);
      else await downloadCsv(href(type), `${type}-${from}-${to}.csv`);
      toast(`${title} ${format === "xlsx" ? "Excel file" : format.toUpperCase()} downloaded.`, { tone: "success" });
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Export could not be downloaded.",
        { tone: "error" },
      );
    } finally {
      setDownloading(null);
    }
  };
  return (
    <>
      <Topbar title="Reports" />
      <div className="portal-content portal-stack">
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="text-sm">
            From
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Through
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {invalidRange && (
            <p className="text-sm text-red-600 sm:col-span-2">
              From date must be before the through date.
            </p>
          )}
          {/*
            The figures below count the jobs held in memory, which is a window
            around today. The exports query the database over whatever range is
            asked for, so a range reaching past the window makes the two
            disagree — and the CSV is the one that is right.
          */}
          {reachesPastLoaded && !invalidRange && (
            <p className="text-sm text-brand-steel sm:col-span-2">
              Figures below cover {loadedFrom} onwards. The exports cover
              the full range you chose.
            </p>
          )}
        </Card>
        <div className="portal-metric-grid">
          <Metric label="Jobs" value={selected.length} />
          <Metric
            label="Completed"
            value={selected.filter((j) => j.status === "complete").length}
          />
          <Metric
            label="Recorded Receivables"
            value={new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(revenue / 100)}
          />
          <Metric label="Assets" value={trucks.length + dumpsters.length} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {reportCards.map(([title, description, type]) => (
            <Card key={type} className="p-5">
              <h2 className="font-semibold">{title} Export</h2>
              <p className="mt-1 text-sm text-brand-steel">{description}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button disabled={!canMutate || invalidRange || downloading !== null} onClick={() => void download(type, title, "xlsx")}>{downloading === `${type}:xlsx` ? "Downloading…" : "Download Excel"}</Button>
                <Button variant="secondary" disabled={!canMutate || invalidRange || downloading !== null} onClick={() => void download(type, title, "pdf")}>{downloading === `${type}:pdf` ? "Downloading…" : "Download PDF"}</Button>
              </div>
              <button type="button" className="mt-2 text-xs text-brand-blue underline-offset-2 hover:underline disabled:opacity-40" disabled={!canMutate || invalidRange || downloading !== null} onClick={() => void download(type, title, "csv")}>{downloading === `${type}:csv` ? "Downloading…" : "Plain CSV for other software"}</button>
            </Card>
          ))}
        </div>
        <p className="text-xs text-brand-steel">Excel files open in Excel and can be uploaded to Google Sheets. PDF files are ready to print or file.</p>
      </div>
    </>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="portal-card-pad">
      <div className="font-heading text-2xl font-bold min-[390px]:text-3xl">
        {value}
      </div>
      <div className="text-sm uppercase text-brand-steel">{label}</div>
    </Card>
  );
}
