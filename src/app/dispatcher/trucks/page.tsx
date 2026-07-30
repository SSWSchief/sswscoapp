"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { AddTruckModal } from "@/components/dispatcher/AssetModals";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TruckStatusBadge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getJob, getTrucks, getUser } from "@/lib/data";

// Screen 8 (Trucks tab) — Asset Management.
export default function TrucksPage() {
  const [open, setOpen] = useState(false);
  const trucks = getTrucks();

  return (
    <>
      <Topbar
        title="Trucks"
        action={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            Add Truck
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <Table>
            <THead>
              <TH>Truck #</TH>
              <TH>Status</TH>
              <TH>Driver</TH>
              <TH>Current Job</TH>
              <TH>License</TH>
              <TH>AirTag / GPS</TH>
              <TH>Notes</TH>
            </THead>
            <TBody>
              {trucks.map((t) => {
                const driver = t.assignedDriverId
                  ? getUser(t.assignedDriverId)
                  : null;
                const job = t.currentJobId ? getJob(t.currentJobId) : null;
                return (
                  <TR key={t.id}>
                    <TD className="font-semibold text-brand-charcoal">{t.number}</TD>
                    <TD>
                      <TruckStatusBadge status={t.status} />
                    </TD>
                    <TD>{driver?.fullName ?? "—"}</TD>
                    <TD>
                      {job ? (
                        <Link
                          href={`/dispatcher/jobs/${job.id}`}
                          className="text-brand-blue hover:underline"
                        >
                          {job.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-brand-steel">{t.licensePlate}</TD>
                    <TD>
                      <div className="text-sm text-brand-charcoal">{t.airTagId ?? "—"}</div>
                      <div className="text-xs text-brand-steel">{t.gpsSource ?? "manual"}</div>
                    </TD>
                    <TD className="text-brand-steel">{t.notes || "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Total {trucks.length} trucks
          </div>
        </Card>
      </div>

      <AddTruckModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
