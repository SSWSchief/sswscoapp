"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import type { ProfitRow } from "@/lib/billing/profitability";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

/** "$31.25" or "31.25" as cents; blank is null; anything else is invalid. */
export function parseDollars(value: string): number | null | "invalid" {
  const trimmed = value.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  return Math.round(Number(trimmed) * 100);
}

const asDollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

interface CostFields {
  route_miles: number | null;
  fuel_override_cents: number | null;
  dump_fee_override_cents: number | null;
  other_cents: number;
  notes: string;
}

/**
 * One job's costs, as management corrects them: the miles the truck ran
 * (fuel follows from mpg and the diesel price), and figures that replace the
 * calculated fuel or dump fee when the real number is known.
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
  const [other, setOther] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!row) return;
    setError("");
    void createClient()
      .from("job_costs")
      .select("route_miles,fuel_override_cents,dump_fee_override_cents,other_cents,notes")
      .eq("job_id", row.jobId)
      .maybeSingle()
      .then(({ data }) => {
        const costs = data as CostFields | null;
        setMiles(costs?.route_miles != null ? String(costs.route_miles) : "");
        setFuel(asDollars(costs?.fuel_override_cents));
        setDump(asDollars(costs?.dump_fee_override_cents));
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
    const [fuelCents, dumpCents, otherCents] = [fuel, dump, other].map(parseDollars);
    if ([fuelCents, dumpCents, otherCents].includes("invalid")) {
      setError("Enter dollar amounts like 268.40.");
      return;
    }
    setBusy(true);
    const fields = {
      route_miles: routeMiles === null ? null : Math.round(routeMiles * 10) / 10,
      fuel_override_cents: fuelCents as number | null,
      dump_fee_override_cents: dumpCents as number | null,
      other_cents: (otherCents as number | null) ?? 0,
      notes: notes.trim(),
      updated_by_id: userId,
    };
    const db = createClient();
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
              <Input inputMode="decimal" placeholder="Calculated" value={fuel} onChange={(event) => setFuel(event.target.value)} />
            </FormField>
            <FormField label="Actual dump fee ($)">
              <Input inputMode="decimal" placeholder="From ticket" value={dump} onChange={(event) => setDump(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Other costs ($)">
            <Input inputMode="decimal" placeholder="0.00" value={other} onChange={(event) => setOther(event.target.value)} />
          </FormField>
          <FormField label="Notes">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          <p className="text-xs text-brand-steel">
            Leave the actual fuel and dump fee blank to use the calculated figures: miles ÷ truck mpg × diesel price, and the driver&apos;s ticket charge.
          </p>
        </div>
      )}
    </Modal>
  );
}
