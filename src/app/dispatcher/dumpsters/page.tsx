"use client";

import { useState } from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { AddDumpsterModal } from "@/components/dispatcher/AssetModals";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DumpsterStatusBadge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import type { Dumpster } from "@/lib/types";

// Screen 8 (Dumpsters tab) — Asset Management.
export default function DumpstersPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dumpster | undefined>();
  const { dumpsters } = useOperations();

  return (
    <>
      <Topbar
        title="Dumpsters"
        action={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }} aria-label="Add dumpster">
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Dumpster</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card>
          <Table className="hidden md:block">
            <THead>
              <TH>Dumpster ID</TH>
              <TH>Size</TH>
              <TH>Status</TH>
              <TH>Current Location</TH>
              <TH>AirTag ID</TH>
              <TH>Edit</TH>
            </THead>
            <TBody>
              {dumpsters.map((d) => (
                <TR key={d.id}>
                  <TD className="font-semibold text-brand-charcoal">{d.code}</TD>
                  <TD>{d.size}</TD>
                  <TD>
                    <DumpsterStatusBadge status={d.status} />
                  </TD>
                  <TD className="text-brand-steel">{d.currentLocation}</TD>
                  <TD className="text-brand-steel">{d.airTagId ?? "—"}</TD>
                  <TD><button className="min-h-11 min-w-11 text-brand-blue" onClick={() => { setEditing(d); setOpen(true); }} aria-label={`Edit ${d.code}`}><Icon name="edit" width={18} height={18} /></button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <ul className="divide-y divide-brand-ice/60 md:hidden">
            {dumpsters.map((dumpster) => (
              <li key={dumpster.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold text-brand-charcoal">{dumpster.code}</h2><p className="mt-1 text-sm text-brand-steel">{dumpster.size} · {dumpster.type}</p></div>
                  <DumpsterStatusBadge status={dumpster.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs uppercase text-brand-silver">Location</dt><dd className="mt-0.5 break-words text-brand-charcoal">{dumpster.currentLocation}</dd></div>
                  <div><dt className="text-xs uppercase text-brand-silver">AirTag</dt><dd className="mt-0.5 text-brand-charcoal">{dumpster.airTagId ?? "—"}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Total {dumpsters.length} dumpsters
          </div>
        </Card>
      </div>

      <AddDumpsterModal open={open} onClose={() => setOpen(false)} dumpster={editing} />
    </>
  );
}
