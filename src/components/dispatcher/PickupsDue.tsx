"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { useOperations } from "@/components/system/OperationsProvider";
import { RecordPickupButton } from "@/components/dispatcher/RecordPickup";
import { pickupTiming } from "@/lib/pickups";
import { formatDate } from "@/lib/utils";

/**
 * Cans still at a jobsite whose pickup is due today, overdue, or was never
 * given a date. A delivery is finished the moment the can is set, so without
 * this the pickup it owes would not appear anywhere on pickup day.
 */
export function PickupsDue() {
  const { openPlacements, customers, dumpsters } = useOperations();
  const rows = React.useMemo(
    () =>
      openPlacements
        .map((placement) => ({
          placement,
          timing: pickupTiming(placement),
        }))
        .filter(({ timing }) => timing !== "upcoming")
        .sort((a, b) =>
          (a.placement.expectedPickupAt ?? "").localeCompare(
            b.placement.expectedPickupAt ?? "",
          ),
        ),
    [openPlacements],
  );
  const label = { overdue: "Overdue", today: "Today", unscheduled: "No date", upcoming: "" };

  return (
    <Card>
      <CardHeader title="Pickups Needed" />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-brand-steel">
          No pickups are due today.
        </p>
      ) : (
        <ul className="divide-y divide-brand-ice/60">
          {rows.map(({ placement, timing }) => (
            <li key={placement.id} className="px-5 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-brand-charcoal">
                  {customers.find((item) => item.id === placement.customerId)?.name ?? "Unknown customer"}
                </span>
                <span
                  className={
                    timing === "today"
                      ? "text-xs font-semibold uppercase text-brand-blue"
                      : "text-xs font-semibold uppercase text-amber-700"
                  }
                >
                  {label[timing]}
                  {placement.expectedPickupAt && timing === "overdue"
                    ? ` · ${formatDate(placement.expectedPickupAt)}`
                    : ""}
                </span>
              </div>
              <p className="mt-0.5 break-words text-brand-steel">
                {dumpsters.find((item) => item.id === placement.dumpsterId)?.code ?? "—"} · {placement.address}
              </p>
              <RecordPickupButton
                placement={placement}
                code={dumpsters.find((item) => item.id === placement.dumpsterId)?.code ?? "Dumpster"}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 pb-4 pt-2">
        <Link href="/dispatcher/dumpsters" className="text-sm font-medium text-brand-blue hover:underline">
          See everything on site →
        </Link>
      </div>
    </Card>
  );
}
