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
                    <TD className="font-semibold text-gray-900">{t.number}</TD>
                    <TD>
                      <TruckStatusBadge status={t.status} />
                    </TD>
                    <TD>{driver?.fullName ?? "—"}</TD>
                    <TD>
                      {job ? (
                        <Link
                          href={`/dispatcher/jobs/${job.id}`}
                          className="text-brand-500 hover:underline"
                        >
                          {job.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-gray-500">{t.licensePlate}</TD>
                    <TD className="text-gray-500">{t.notes || "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
            Total {trucks.length} trucks
          </div>
        </Card>
      </div>

      <AddTruckModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
