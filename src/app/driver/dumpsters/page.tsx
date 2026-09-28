"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { DumpsterStatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { mapDumpster } from "@/lib/supabase/mappers";
import type { DumpsterRow } from "@/lib/supabase/database.types";
import type { Dumpster } from "@/lib/types";

const pageSize = 200;

export default function DriverDumpstersPage() {
  const [dumpsters, setDumpsters] = React.useState<Dumpster[] | null>(null);
  const [error, setError] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const db = createClient();
      const all: Dumpster[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const result = await db.from("dumpsters").select("*")
          .is("deleted_at", null).order("code").range(offset, offset + pageSize - 1);
        if (cancelled) return;
        if (result.error) {
          setError(true);
          return;
        }
        all.push(...((result.data ?? []) as DumpsterRow[]).map(mapDumpster));
        if ((result.data ?? []).length < pageSize) break;
      }
      if (!cancelled) setDumpsters(all);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = (dumpsters ?? []).filter((dumpster) =>
    [dumpster.code, dumpster.size, dumpster.type, dumpster.status, dumpster.currentLocation, dumpster.airTagId ?? ""]
      .some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <>
      <MobileHeader title="Dumpsters" />
      <main className="flex-1 space-y-3 overflow-y-auto bg-surface p-4 dark:bg-gray-950">
        <label className="block text-xs font-semibold uppercase text-brand-steel">
          Find a dumpster
          <Input className="mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, size, status, or location" />
        </label>
        {error && <Card className="p-5 text-sm text-red-700">Dumpster inventory could not be loaded. Try again later.</Card>}
        {!error && dumpsters === null && <Card className="p-5 text-sm text-brand-steel">Loading dumpsters…</Card>}
        {!error && dumpsters !== null && <p className="text-xs text-brand-steel">{filtered.length} of {dumpsters.length} dumpsters · Read only</p>}
        {!error && dumpsters !== null && filtered.length === 0 && <Card className="p-5 text-sm text-brand-steel">No dumpsters match your search.</Card>}
        {filtered.map((dumpster) => (
          <Card key={dumpster.id} className="p-4 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-brand-charcoal dark:text-white">{dumpster.code}</h2>
                <p className="text-sm text-brand-steel dark:text-gray-300">{dumpster.size} · {dumpster.type}</p>
              </div>
              <DumpsterStatusBadge status={dumpster.status} />
            </div>
            <dl className="mt-3 grid gap-2 border-t border-brand-ice pt-3 text-sm dark:border-white/10">
              <div><dt className="text-xs uppercase text-brand-steel">Current location</dt><dd className="break-words text-brand-charcoal dark:text-white">{dumpster.currentLocation || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-brand-steel">AirTag ID</dt><dd className="break-words text-brand-charcoal dark:text-white">{dumpster.airTagId || "—"}</dd></div>
            </dl>
          </Card>
        ))}
      </main>
    </>
  );
}
