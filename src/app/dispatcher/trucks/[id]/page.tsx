"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TruckStatusBadge } from "@/components/ui/StatusBadge";
import { useOperations } from "@/components/system/OperationsProvider";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function TruckDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { trucks, jobs, users, hydrated } = useOperations();
  const truck = trucks.find((item) => item.id === id);
  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!truck) notFound();
  const driver = truck.assignedDriverId ? users.find((item) => item.id === truck.assignedDriverId) : null;
  const job = truck.currentJobId ? jobs.find((item) => item.id === truck.currentJobId) : null;

  return (
    <>
      <Topbar title={`Truck ${truck.number}`} />
      <div className="portal-content space-y-5">
        <Link href="/dispatcher/trucks" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand-steel hover:text-brand-charcoal">
          <Icon name="chevron-right" width={16} height={16} className="rotate-180" /> Back to Trucks
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-charcoal">{truck.number}</h2>
          <TruckStatusBadge status={truck.status} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader title="Vehicle Details" />
            <dl className="p-5 space-y-4">
              <Detail label="Make / Model" value={`${truck.make} ${truck.model}`} />
              <Detail label="Vehicle Type" value={truck.type} />
              <Detail label="VIN" value={truck.vin} mono />
              <Detail label="License Plate" value={truck.licensePlate} />
              <Detail label="Registration Due" value={formatDate(truck.registrationDueDate)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Mileage & Preventive Maintenance" />
            <dl className="p-5 space-y-4">
              <Detail label="Current Mileage" value={`${truck.mileage.toLocaleString()} mi`} />
              <Detail label="Last PM" value={`${formatDate(truck.lastPmDate)} · ${truck.lastPmMileage.toLocaleString()} mi`} />
              <Detail label="Next PM Date" value={formatDate(truck.nextPmDate)} />
              <Detail label="Next PM Mileage" value={`${truck.nextPmMileage.toLocaleString()} mi`} />
            </dl>
            <div className="mx-5 mb-5 rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Mileage is maintained manually and can be captured with each electronic pre-trip inspection.
            </div>
          </Card>

          <Card>
            <CardHeader title="Current Assignment" />
            <dl className="p-5 space-y-4">
              <Detail label="Driver" value={driver?.fullName ?? "Unassigned"} />
              <Detail label="Current Job" value={job?.reference ?? "—"} />
              <Detail label="AirTag / GPS" value={truck.airTagId ?? "—"} />
              <Detail label="Last Known Location" value={truck.lastKnownLocation ?? "—"} />
              <Detail label="Last Seen" value={truck.lastSeenAt ? formatDateTime(truck.lastSeenAt) : "—"} />
              <Detail label="Notes" value={truck.notes || "—"} />
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-medium text-brand-charcoal ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
