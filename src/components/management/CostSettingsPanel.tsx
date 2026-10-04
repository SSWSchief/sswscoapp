"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Field";
import { useToast } from "@/components/system/ToastProvider";
import { parseDollars } from "@/components/management/JobCostModal";
import type { CostDefaultRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";

interface SizeDefaults {
  dumpster_size: CostDefaultRow["dumpster_size"];
  labor: string;
  dump: string;
}
interface TruckMpg {
  id: string;
  number: string;
  mpg: string;
}

const asDollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

/**
 * The inputs every job's costs are figured from, as Austin's workbook kept
 * them on its Assumptions sheet: the diesel price and yard (fuel follows the
 * miles actually run, never a flat rate), each truck's mpg, and per size the
 * labor per haul and a fallback dump fee for when no ticket charge exists.
 *
 * Changes apply to jobs completed from now on. A completed job keeps the
 * diesel price, mpg and labor it was completed with, so editing these never
 * rewrites a past month.
 */
export function CostSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [diesel, setDiesel] = React.useState("");
  const [yard, setYard] = React.useState("");
  const [sizes, setSizes] = React.useState<SizeDefaults[]>([]);
  const [trucks, setTrucks] = React.useState<TruckMpg[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const db = createClient();
    void Promise.all([
      db.from("operating_costs").select("yard_address,diesel_cents_per_gallon").maybeSingle(),
      db.from("cost_defaults").select("dumpster_size,labor_cents,dump_fee_cents").order("dumpster_size"),
      db.from("trucks").select("id,number,mpg").is("deleted_at", null).order("number"),
    ]).then(([costs, defaults, fleet]) => {
      setDiesel(asDollars(costs.data?.diesel_cents_per_gallon ?? null));
      setYard(costs.data?.yard_address ?? "");
      setSizes((defaults.data ?? []).map((row) => ({
        dumpster_size: row.dumpster_size,
        labor: asDollars(row.labor_cents),
        dump: asDollars(row.dump_fee_cents),
      })));
      setTrucks((fleet.data ?? []).map((truck) => ({ id: truck.id, number: truck.number, mpg: truck.mpg == null ? "" : String(truck.mpg) })));
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    const dieselCents = parseDollars(diesel);
    const sizeCents = sizes.map((size) => ({ size, labor: parseDollars(size.labor), dump: parseDollars(size.dump) }));
    const mpgs = trucks.map((truck) => ({ truck, mpg: truck.mpg.trim() ? Number(truck.mpg) : null }));
    if (dieselCents === "invalid" || sizeCents.some((entry) => entry.labor === "invalid" || entry.dump === "invalid")) {
      toast("Enter dollar amounts like 4.59.", { tone: "error" });
      return;
    }
    if (dieselCents === 0) {
      toast("The diesel price must be above zero.", { tone: "error" });
      return;
    }
    if (mpgs.some((entry) => entry.mpg !== null && !(Number.isFinite(entry.mpg) && entry.mpg > 0 && entry.mpg < 100))) {
      toast("Enter each truck's mpg as a number, like 6.5.", { tone: "error" });
      return;
    }
    setBusy(true);
    const db = createClient();
    const results = await Promise.all([
      db.from("operating_costs").update({ diesel_cents_per_gallon: dieselCents, yard_address: yard.trim() || null }).eq("id", true),
      ...sizeCents.map((entry) =>
        db.from("cost_defaults").update({ labor_cents: entry.labor as number | null, dump_fee_cents: entry.dump as number | null }).eq("dumpster_size", entry.size.dumpster_size)),
      ...mpgs.map((entry) => db.from("trucks").update({ mpg: entry.mpg }).eq("id", entry.truck.id)),
    ]);
    setBusy(false);
    if (results.some((result) => result.error)) {
      toast("Some cost settings could not be saved.", { tone: "error" });
      return;
    }
    toast("Cost settings saved. They apply to jobs completed from now on.", { tone: "success" });
    onSaved();
  };

  return (
    <Card>
      <CardHeader title="Cost Settings" />
      {!loaded ? (
        <p className="px-5 py-4 text-sm text-brand-steel">Loading…</p>
      ) : (
        <div className="grid gap-5 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <FormField label="Diesel ($/gal)">
              <Input inputMode="decimal" placeholder="e.g. 4.59" value={diesel} onChange={(event) => setDiesel(event.target.value)} />
            </FormField>
            <FormField label="Yard address (blank = company address)">
              <Input value={yard} onChange={(event) => setYard(event.target.value)} />
            </FormField>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-charcoal">Per dumpster size</p>
            <div className="mt-2 grid gap-2">
              {sizes.map((size, index) => (
                <div key={size.dumpster_size} className="grid grid-cols-[5rem_1fr_1fr] items-end gap-2">
                  <span className="pb-2 text-sm">{size.dumpster_size}</span>
                  <FormField label="Labor per haul ($)">
                    <Input inputMode="decimal" value={size.labor} onChange={(event) => setSizes((all) => all.map((entry, at) => at === index ? { ...entry, labor: event.target.value } : entry))} />
                  </FormField>
                  <FormField label="Fallback dump fee ($)">
                    <Input inputMode="decimal" placeholder="None" value={size.dump} onChange={(event) => setSizes((all) => all.map((entry, at) => at === index ? { ...entry, dump: event.target.value } : entry))} />
                  </FormField>
                </div>
              ))}
            </div>
          </div>
          {trucks.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-brand-charcoal">Truck fuel economy</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {trucks.map((truck, index) => (
                  <FormField key={truck.id} label={`${truck.number} (mpg)`}>
                    <Input inputMode="decimal" placeholder="e.g. 6.5" value={truck.mpg} onChange={(event) => setTrucks((all) => all.map((entry, at) => at === index ? { ...entry, mpg: event.target.value } : entry))} />
                  </FormField>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-brand-steel">Applies to jobs completed from now on; finished jobs keep the figures they were completed with.</p>
            <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save Cost Settings"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
