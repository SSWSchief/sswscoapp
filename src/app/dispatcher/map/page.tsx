"use client";
import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PlatformMapLink } from "@/components/ui/PlatformMapLink";
import { FindMyLink, useApplePlatform } from "@/components/ui/FindMyLink";
import {
  LocationCheckModal,
  type CheckableAsset,
} from "@/components/dispatcher/LocationCheckModal";
import { useOperations } from "@/components/system/OperationsProvider";
import { RelativeTime } from "@/components/ui/RelativeTime";
import {
  assetCheckKey,
  checkFreshness,
  freshnessLabel,
  latestCheckByAsset,
  locationSourceLabel,
  type CheckFreshness,
} from "@/lib/location-checks";

const freshnessClass: Record<CheckFreshness, string> = {
  none: "bg-brand-mist text-brand-steel",
  fresh: "bg-emerald-100 text-emerald-700",
  aging: "bg-amber-100 text-amber-700",
  stale: "bg-red-100 text-red-700",
};

export default function Page() {
  const { trucks, dumpsters, jobs, customers, assetLocationChecks } =
    useOperations();
  const [q, setQ] = React.useState("");
  const [checking, setChecking] = React.useState<CheckableAsset | null>(null);
  const isApple = useApplePlatform();
  const query = q.toLowerCase();

  const latestChecks = React.useMemo(
    () => latestCheckByAsset(assetLocationChecks),
    [assetLocationChecks],
  );

  const assets = [
    ...trucks.map((t) => ({
      key: assetCheckKey("truck", t.id),
      asset: {
        type: "truck" as const,
        id: t.id,
        label: t.number,
        airTagId: t.airTagId,
      },
      type: "Truck",
      airTag: t.airTagId,
      operational: t.lastKnownLocation ?? "Unknown",
      jobId: t.currentJobId,
    })),
    ...dumpsters.map((d) => ({
      key: assetCheckKey("dumpster", d.id),
      asset: {
        type: "dumpster" as const,
        id: d.id,
        label: d.code,
        airTagId: d.airTagId,
      },
      type: "Dumpster",
      airTag: d.airTagId,
      operational: d.currentLocation || "Unknown",
      jobId: d.currentJobId,
    })),
  ].filter((a) => {
    const check = latestChecks.get(a.key);
    return `${a.asset.label} ${a.type} ${a.airTag ?? ""} ${a.operational} ${check?.location ?? ""}`
      .toLowerCase()
      .includes(query);
  });

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
              const check = latestChecks.get(a.key);
              const freshness = checkFreshness(check);
              // A recorded check outranks the operational address: someone
              // actually looked. Without one, all we have is where dispatch
              // last sent it.
              const shown = check?.location ?? a.operational;
              return (
                <article
                  key={a.key}
                  className="flex flex-col rounded border border-brand-ice p-4"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="text-xs uppercase text-brand-steel">
                        {a.type}
                      </div>
                      <h2 className="font-semibold">{a.asset.label}</h2>
                    </div>
                    <span className="font-mono text-xs text-brand-blue">
                      {a.airTag || "No AirTag"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm">{shown}</p>
                  <p className="text-xs text-brand-steel">
                    {job
                      ? `${job.reference} · ${customer?.name ?? "Customer"}`
                      : "No active job"}
                  </p>

                  <div className="mt-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${freshnessClass[freshness]}`}
                    >
                      {freshnessLabel[freshness]}
                    </span>
                    {check && (
                      <p className="mt-1 text-xs text-brand-silver">
                        {locationSourceLabel[check.source]} ·{" "}
                        {check.checkedByName ?? "Staff"} ·{" "}
                        <RelativeTime iso={check.checkedAt} />
                      </p>
                    )}
                    {check?.note && (
                      <p className="mt-1 text-xs text-brand-steel">
                        {check.note}
                      </p>
                    )}
                    {!check && a.operational !== "Unknown" && (
                      <p className="mt-1 text-xs text-brand-silver">
                        Operational address only — nobody has confirmed this
                        one.
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Button
                      variant="secondary"
                      onClick={() => setChecking(a.asset)}
                      className="min-h-11 flex-1"
                    >
                      Record check
                    </Button>
                    {a.airTag && (
                      <FindMyLink className="flex min-h-11 flex-1 items-center justify-center rounded border border-brand-blue px-3 text-sm font-medium text-brand-blue" />
                    )}
                    {shown !== "Unknown" && (
                      <PlatformMapLink
                        address={shown}
                        className="flex min-h-11 flex-1 items-center justify-center rounded border border-brand-ice px-3 text-sm font-medium text-brand-steel"
                      >
                        Open in Maps
                      </PlatformMapLink>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!assets.length && (
            <p className="p-8 text-center text-brand-steel">
              No assets match this search.
            </p>
          )}
          <div className="space-y-1 border-t border-brand-ice p-4 text-xs text-brand-steel">
            <p>
              Every location here was entered by a person. Apple provides no
              AirTag data feed, so Overwatch cannot read tag positions or track
              anything live.
            </p>
            <p>
              {isApple
                ? "“Open Find My” hands off to Apple’s app, where you pick the asset yourself. The position it shows is the last time a passing Apple device reported the tag — it can be hours old."
                : "“Open Find My” is hidden on this device: AirTags can only be viewed in the Find My app on an iPhone, iPad, or Mac. iCloud.com does not show them."}
            </p>
          </div>
        </Card>
      </div>
      <LocationCheckModal
        open={checking !== null}
        onClose={() => setChecking(null)}
        asset={checking}
      />
    </>
  );
}
