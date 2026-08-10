"use client";
import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { PlatformMapLink } from "@/components/ui/PlatformMapLink";
import { useOperations } from "@/components/system/OperationsProvider";
import { RelativeTime } from "@/components/ui/RelativeTime";
export default function Page() {
  const { trucks, dumpsters, jobs, customers } = useOperations();
  const [q, setQ] = React.useState("");
  const query = q.toLowerCase();
  const assets = [
    ...trucks.map((t) => ({
      id: t.id,
      label: t.number,
      type: "Truck",
      airTag: t.airTagId,
      location: t.lastKnownLocation ?? "Unknown",
      seen: t.lastSeenAt,
      jobId: t.currentJobId,
    })),
    ...dumpsters.map((d) => ({
      id: d.id,
      label: d.code,
      type: "Dumpster",
      airTag: d.airTagId,
      location: d.currentLocation || "Unknown",
      seen: undefined,
      jobId: d.currentJobId,
    })),
  ].filter((a) =>
    `${a.label} ${a.type} ${a.airTag ?? ""} ${a.location}`
      .toLowerCase()
      .includes(query),
  );
  return (
    <>
      <Topbar title="Locations & AirTags" />
      <div className="portal-content">
        <Card>
          <CardHeader title="Operational Locations" />
          <div className="border-b border-brand-ice p-4">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search asset, AirTag ID, or location"
            />
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((a) => {
              const job = jobs.find((j) => j.id === a.jobId);
              const customer = job
                ? customers.find((c) => c.id === job.customerId)
                : null;
              return (
                <article
                  key={`${a.type}-${a.id}`}
                  className="rounded border border-brand-ice p-4"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="text-xs uppercase text-brand-steel">
                        {a.type}
                      </div>
                      <h2 className="font-semibold">{a.label}</h2>
                    </div>
                    <span className="font-mono text-xs text-brand-blue">
                      {a.airTag || "No AirTag"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">{a.location}</p>
                  <p className="text-xs text-brand-steel">
                    {job
                      ? `${job.reference} · ${customer?.name ?? "Customer"}`
                      : "No active job"}
                  </p>
                  {a.seen && (
                    <p className="mt-1 text-xs text-brand-silver">
                      Confirmed <RelativeTime iso={a.seen} />
                    </p>
                  )}
                  {a.location !== "Unknown" && (
                    <PlatformMapLink
                      address={a.location}
                      className="mt-3 flex min-h-11 items-center justify-center rounded border border-brand-blue text-sm font-medium text-brand-blue"
                    >
                      Open in Maps
                    </PlatformMapLink>
                  )}
                </article>
              );
            })}
          </div>
          {!assets.length && (
            <p className="p-8 text-center text-brand-steel">
              No assets match this search.
            </p>
          )}
          <p className="border-t border-brand-ice p-4 text-xs text-brand-steel">
            Locations are operational or manually confirmed. AirTag identifiers
            are records only; this screen does not provide Apple Find My or live
            GPS data.
          </p>
        </Card>
      </div>
    </>
  );
}
