"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import type { ProfitRow } from "@/lib/billing/profitability";
import type { DumpsterSize } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

/** "$31.25" or "31.25" as cents; blank is null; anything else is invalid. */
export function parseDollars(value: string): number | null | "invalid" {
  const trimmed = value.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  return Math.round(Number(trimmed) * 100);
}

/** A blank field's placeholder: what the page is using now, or what it would use. */
const estimate = (cents: number | null, fallback: string) =>
  cents === null ? fallback : `Now ${formatCurrency(cents)}`;

const asDollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

interface CostFields {
  route_miles: number | null;
  fuel_override_cents: number | null;
  dump_fee_override_cents: number | null;
  labor_cents: number | null;
  labor_source: "estimated" | "actual" | null;
  other_cents: number;
  notes: string;
}

/**
 * One job's costs, as management corrects them: the miles the truck ran
 * (fuel follows from mpg and the diesel price), and figures that replace the
 * calculated fuel, dump fee or labor when the real number is known. Every job
 * varies (Austin, 2026-10-15), so each of the three can be set per job.
 */
export function JobCostModal({
  row,
  userId,
  onClose,
  onSaved,
}: {
  row: ProfitRow | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [miles, setMiles] = React.useState("");
  const [fuel, setFuel] = React.useState("");
  const [dump, setDump] = React.useState("");
  const [labor, setLabor] = React.useState("");
  const [other, setOther] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!row) return;
    setError("");
    void createClient()
      .from("job_costs")
      .select("route_miles,fuel_override_cents,dump_fee_override_cents,labor_cents,labor_source,other_cents,notes")
      .eq("job_id", row.jobId)
      .maybeSingle()
      .then(({ data }) => {
        const costs = data as CostFields | null;
        setMiles(costs?.route_miles != null ? String(costs.route_miles) : "");
        setFuel(asDollars(costs?.fuel_override_cents));
        setDump(asDollars(costs?.dump_fee_override_cents));
        // Only a figure someone entered is shown; the size default stays a placeholder.
        setLabor(costs?.labor_source === "actual" ? asDollars(costs.labor_cents) : "");
        setOther(costs?.other_cents ? asDollars(costs.other_cents) : "");
        setNotes(costs?.notes ?? "");
      });
  }, [row]);

  const save = async () => {
    if (!row) return;
    const routeMiles = miles.trim() ? Number(miles) : null;
    if (routeMiles !== null && !(Number.isFinite(routeMiles) && routeMiles >= 0 && routeMiles < 1_000_000)) {
      setError("Enter route miles as a number, like 26.5.");
      return;
    }
    const [fuelCents, dumpCents, laborCents, otherCents] = [fuel, dump, labor, other].map(parseDollars);
    if ([fuelCents, dumpCents, laborCents, otherCents].includes("invalid")) {
      setError("Enter dollar amounts like 268.40.");
      return;
    }
    setBusy(true);
    const db = createClient();
    // A blank labor figure goes back to the size's default, as the job had it
    // when it completed.
    let laborFields: Pick<CostFields, "labor_cents" | "labor_source">;
    if (laborCents !== null) {
      laborFields = { labor_cents: laborCents as number, labor_source: "actual" };
    } else {
      const { data: defaults } = await db
        .from("cost_defaults")
        .select("labor_cents")
        .eq("dumpster_size", row.dumpsterSize as DumpsterSize)
        .maybeSingle();
      const fallback = (defaults as { labor_cents: number | null } | null)?.labor_cents ?? null;
      laborFields = { labor_cents: fallback, labor_source: fallback === null ? null : "estimated" };
    }
    const fields = {
      route_miles: routeMiles === null ? null : Math.round(routeMiles * 10) / 10,
      fuel_override_cents: fuelCents as number | null,
      dump_fee_override_cents: dumpCents as number | null,
      ...laborFields,
      other_cents: (otherCents as number | null) ?? 0,
      notes: notes.trim(),
      updated_by_id: userId,
    };
    const existing = await db.from("job_costs").select("id").eq("job_id", row.jobId).maybeSingle();
    const result = existing.data
      ? await db.from("job_costs").update(fields).eq("job_id", row.jobId)
      : await db.from("job_costs").insert({ job_id: row.jobId, ...fields });
    setBusy(false);
    if (result.error) {
      toast("The costs could not be saved.", { tone: "error" });
      return;
    }
    toast(`Costs saved for ${row.reference}.`, { tone: "success" });
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={row !== null}
      onClose={busy ? () => {} : onClose}
      title={row ? `Costs for ${row.reference}` : "Costs"}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save Costs"}</Button>
        </>
      }
    >
      {row && (
        <div className="grid gap-4">
          <p className="text-sm text-brand-steel">
            {row.customerName} · {row.dumpsterSize} {row.serviceType} · revenue {formatCurrency(row.revenueCents)}
          </p>
          <FormField label="Route miles (yard → job → dump or yard)" error={error}>
            <Input inputMode="decimal" placeholder="e.g. 26" value={miles} onChange={(event) => { setError(""); setMiles(event.target.value); }} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Actual fuel ($)">
              <Input inputMode="decimal" placeholder={estimate(row.fuelCents, "Calculated")} value={fuel} onChange={(event) => setFuel(event.target.value)} />
            </FormField>
            <FormField label="Actual dump fee ($)">
              <Input inputMode="decimal" placeholder={estimate(row.dumpFeeCents, "From ticket")} value={dump} onChange={(event) => setDump(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Actual labor ($)">
            <Input inputMode="decimal" placeholder={estimate(row.laborCents, "Size default")} value={labor} onChange={(event) => setLabor(event.target.value)} />
          </FormField>
          <FormField label="Other costs ($)">
            <Input inputMode="decimal" placeholder="0.00" value={other} onChange={(event) => setOther(event.target.value)} />
          </FormField>
          <FormField label="Notes">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          <p className="text-xs text-brand-steel">
            Leave a figure blank to use the calculated one shown in grey: fuel is miles ÷ truck mpg × diesel price, the dump fee is the driver&apos;s ticket charge, and labor is the default for the dumpster size (set below the jobs list).
          </p>
        </div>
      )}
    </Modal>
  );
}
