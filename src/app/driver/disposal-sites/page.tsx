"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import type { DisposalSiteRow } from "@/lib/supabase/database.types";

const materialRules = (site: DisposalSiteRow) =>
  Array.isArray(site.material_rules) ? site.material_rules.map((rule) => String(rule)) : [];

export default function DriverDisposalSitesPage() {
  const [sites, setSites] = React.useState<DisposalSiteRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    void createClient().from("disposal_sites").select("*").eq("is_active", true).order("name")
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(true);
        else setSites((data ?? []) as DisposalSiteRow[]);
      });
    return () => { cancelled = true; };
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = (sites ?? []).filter((site) =>
    [site.name, site.address, site.notes, site.operating_hours, site.truck_restrictions, ...materialRules(site)]
      .some((value) => value.toLowerCase().includes(needle)),
  );

  return (
    <>
      <MobileHeader title="Disposal Sites" />
      <main className="flex-1 space-y-3 overflow-y-auto bg-surface p-4 dark:bg-gray-950">
        <label className="block text-xs font-semibold uppercase text-brand-steel">
          Find a disposal site
          <Input className="mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, area, or material" />
        </label>
        {error && <Card className="p-5 text-sm text-red-700">Disposal sites could not be loaded. Try again later.</Card>}
        {!error && sites === null && <Card className="p-5 text-sm text-brand-steel">Loading disposal sites…</Card>}
        {!error && sites !== null && <p className="text-xs text-brand-steel">{filtered.length} of {sites.length} sites · Read only</p>}
        {!error && sites !== null && filtered.length === 0 && <Card className="p-5 text-sm text-brand-steel">No disposal sites match your search.</Card>}
        {filtered.map((site) => (
          <Card key={site.id} className="p-4 dark:bg-gray-900">
            <h2 className="font-semibold text-brand-charcoal dark:text-white">{site.name}</h2>
            {site.address && (
              <a className="mt-1 block text-sm text-brand-blue underline-offset-2 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.address)}`}>
                {site.address} · Directions
              </a>
            )}
            <dl className="mt-3 grid gap-2 border-t border-brand-ice pt-3 text-sm dark:border-white/10">
              {materialRules(site).length > 0 && <div><dt className="text-xs uppercase text-brand-steel">Materials &amp; rates</dt><dd className="break-words text-brand-charcoal dark:text-white">{materialRules(site).join(" · ")}</dd></div>}
              {site.operating_hours && <div><dt className="text-xs uppercase text-brand-steel">Hours</dt><dd className="break-words text-brand-charcoal dark:text-white">{site.operating_hours}</dd></div>}
              {site.truck_restrictions && <div><dt className="text-xs uppercase text-brand-steel">Truck restrictions</dt><dd className="break-words text-brand-charcoal dark:text-white">{site.truck_restrictions}</dd></div>}
              {site.estimated_wait_minutes > 0 && <div><dt className="text-xs uppercase text-brand-steel">Typical wait</dt><dd className="text-brand-charcoal dark:text-white">{site.estimated_wait_minutes} min</dd></div>}
              {site.notes && <div><dt className="text-xs uppercase text-brand-steel">Notes</dt><dd className="break-words text-brand-charcoal dark:text-white">{site.notes}</dd></div>}
            </dl>
          </Card>
        ))}
      </main>
    </>
  );
}
