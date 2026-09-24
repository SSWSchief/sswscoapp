"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import type { DisposalSiteRow } from "@/lib/supabase/database.types";

export default function DisposalSitesPage() {
  const [sites, setSites] = React.useState<DisposalSiteRow[] | null>(null);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => { void createClient().from("disposal_sites").select("*").eq("is_active", true).order("name").then(({ data }) => setSites(data ?? [])); }, []);
  const visible = (sites ?? []).filter((site) => `${site.name} ${site.address} ${site.notes} ${JSON.stringify(site.material_rules)}`.toLowerCase().includes(query.toLowerCase()));
  return <><Topbar title="Disposal Sites" /><div className="portal-content portal-stack"><Card className="p-4"><div className="relative max-w-md"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel" width={18} height={18} /><Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sites, materials, or rates..." /></div></Card>{sites === null ? <Card className="p-5 text-sm text-brand-steel">Loading disposal sites…</Card> : <div className="grid gap-4 md:grid-cols-2">{visible.map((site) => <Card key={site.id} className="p-5"><h2 className="font-semibold text-brand-charcoal">{site.name}</h2><a className="mt-2 block text-sm text-brand-blue" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}>{site.address}</a>{site.notes && <p className="mt-3 text-sm text-brand-charcoal">{site.notes}</p>}{site.operating_hours && <p className="mt-2 text-sm text-brand-steel">Hours: {site.operating_hours}</p>}{site.truck_restrictions && <p className="mt-2 text-sm text-brand-steel">Restrictions: {site.truck_restrictions}</p>}</Card>)}</div>}{sites !== null && visible.length === 0 && <Card className="p-5 text-sm text-brand-steel">No disposal sites match that search.</Card>}</div></>;
}
