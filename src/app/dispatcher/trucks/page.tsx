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
import { useOperations } from "@/components/system/OperationsProvider";
import type { Truck } from "@/lib/types";

// Screen 8 (Trucks tab) — Asset Management.
export default function TrucksPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | undefined>();
  const { trucks, jobs, users } = useOperations();

  return (
    <>
      <Topbar
        title="Trucks"
        action={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }} aria-label="Add truck">
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Truck</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card>
          <Table className="hidden lg:block">
            <THead>
              <TH>Truck #</TH>
              <TH>Status</TH>
              <TH>Driver</TH>
              <TH>Current Job</TH>
              <TH>License</TH>
              <TH>AirTag / GPS</TH>
              <TH>Notes</TH>
              <TH>Edit</TH>
            </THead>
            <TBody>
              {trucks.map((t) => {
                const driver = t.assignedDriverId
                  ? users.find((item) => item.id === t.assignedDriverId)
                  : null;
                const job = t.currentJobId ? jobs.find((item) => item.id === t.currentJobId) : null;
                return (
                  <TR key={t.id}>
                    <TD className="font-semibold">
                      <Link href={`/dispatcher/trucks/${t.id}`} className="text-brand-blue hover:underline">
                        {t.number}
                      </Link>
                    </TD>
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
                    <TD><button className="min-h-11 min-w-11 text-brand-blue" onClick={() => { setEditing(t); setOpen(true); }} aria-label={`Edit ${t.number}`}><Icon name="edit" width={18} height={18} /></button></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <ul className="divide-y divide-brand-ice/60 lg:hidden">
            {trucks.map((truck) => {
              const driver = truck.assignedDriverId ? users.find((item) => item.id === truck.assignedDriverId) : null;
              const job = truck.currentJobId ? jobs.find((item) => item.id === truck.currentJobId) : null;
              return (
                <li key={truck.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/dispatcher/trucks/${truck.id}`} className="flex min-h-11 items-center font-heading text-lg font-semibold text-brand-blue">{truck.number}</Link>
                    <TruckStatusBadge status={truck.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs uppercase text-brand-silver">Driver</dt><dd className="mt-0.5 text-brand-charcoal">{driver?.fullName ?? "Unassigned"}</dd></div>
                    <div><dt className="text-xs uppercase text-brand-silver">Job</dt><dd className="mt-0.5 text-brand-charcoal">{job?.reference ?? "—"}</dd></div>
                    <div><dt className="text-xs uppercase text-brand-silver">License</dt><dd className="mt-0.5 text-brand-charcoal">{truck.licensePlate}</dd></div>
                    <div><dt className="text-xs uppercase text-brand-silver">Mileage</dt><dd className="mt-0.5 text-brand-charcoal">{truck.mileage.toLocaleString()} mi</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Total {trucks.length} trucks
          </div>
        </Card>
      </div>

      <AddTruckModal open={open} onClose={() => setOpen(false)} truck={editing} />
    </>
  );
}
