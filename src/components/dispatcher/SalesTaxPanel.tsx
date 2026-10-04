"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import {
  recentQuarters,
  returnDueDate,
  salesTaxTotals,
  type SalesTaxTotals,
} from "@/lib/billing/sales-tax-report";
import { downloadPdf, downloadXlsx } from "@/lib/client-download";
import { createClient } from "@/lib/supabase/client";
import { pacificDate } from "@/lib/time-clock";
import { formatCurrency } from "@/lib/utils";

const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * The quarterly sales tax return in figures: what the accountant asks for
 * each quarter, by the date money arrived. Opens on the quarter whose return
 * is due next, so the one the office has to send is the one on screen.
 */
export function SalesTaxPanel() {
  const { toast } = useToast();
  const today = pacificDate(new Date());
  const quarters = React.useMemo(() => recentQuarters(today), [today]);
  const [selected, setSelected] = React.useState(() =>
    today <= returnDueDate(quarters[1].to) ? quarters[1].from : quarters[0].from,
  );
  const quarter = quarters.find((candidate) => candidate.from === selected) ?? quarters[0];
  const [totals, setTotals] = React.useState<SalesTaxTotals | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [downloading, setDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setState("loading");
    void createClient()
      .rpc("sales_tax_rows", { from_date: quarter.from, through_date: quarter.to })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState("error");
          return;
        }
        setTotals(salesTaxTotals(data ?? []));
        setState("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [quarter.from, quarter.to]);

  const download = async (format: "xlsx" | "pdf") => {
    const name = `sales-tax-${quarter.from}-${quarter.to}.${format}`;
    const url = `/api/exports/sales-tax?from=${quarter.from}&to=${quarter.to}&format=${format}`;
    setDownloading(format);
    try {
      if (format === "xlsx") await downloadXlsx(url, name);
      else await downloadPdf(url, name);
      toast(`${quarter.label} sales tax ${format === "xlsx" ? "Excel file" : "PDF"} downloaded.`, { tone: "success" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "The report could not be downloaded.", { tone: "error" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Sales Tax Return</h2>
          <p className="mt-1 text-sm text-brand-steel">
            Nevada sales tax by the date each payment arrived. Return due {longDate(returnDueDate(quarter.to))}.
          </p>
        </div>
        <label className="text-sm sm:w-40">
          <span className="sr-only">Quarter</span>
          <Select aria-label="Quarter" value={quarter.from} onChange={(event) => setSelected(event.target.value)}>
            {quarters.map((candidate) => (
              <option key={candidate.from} value={candidate.from}>{candidate.label}</option>
            ))}
          </Select>
        </label>
      </div>
      {state === "error" ? (
        <p className="mt-4 text-sm text-red-600">The sales tax figures could not be loaded.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Figure label="Total sales" value={state === "ready" && totals ? formatCurrency(totals.salesCents) : "…"} />
          <Figure label="Taxable sales" value={state === "ready" && totals ? formatCurrency(totals.taxableSalesCents) : "…"} />
          <Figure label="Tax collected" value={state === "ready" && totals ? formatCurrency(totals.taxCollectedCents) : "…"} />
          <Figure label="Tax not collected" value={state === "ready" && totals ? formatCurrency(totals.taxNotCollectedCents) : "…"} />
        </dl>
      )}
      {state === "ready" && totals && (
        <p className="mt-3 text-xs text-brand-steel">
          {totals.receipts === 0
            ? `No payments were received in ${quarter.label}. Nevada still expects a $0 return.`
            : `${totals.receipts} payment${totals.receipts === 1 ? "" : "s"} received in ${quarter.label}.`}
          {totals.taxNotCollectedCents > 0 && " Tax not collected is on invoices sent before sales tax was added; the accountant decides how to report it."}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button disabled={downloading !== null} onClick={() => void download("xlsx")}>
          {downloading === "xlsx" ? "Downloading…" : "Download Excel"}
        </Button>
        <Button variant="secondary" disabled={downloading !== null} onClick={() => void download("pdf")}>
          {downloading === "pdf" ? "Downloading…" : "Download PDF"}
        </Button>
      </div>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-brand-ice p-3">
      <dt className="text-xs uppercase text-brand-steel">{label}</dt>
      <dd className="mt-1 font-heading text-lg font-semibold">{value}</dd>
    </div>
  );
}
