"use client";

import { useState } from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { AddDumpsterModal } from "@/components/dispatcher/AssetModals";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DumpsterStatusBadge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getDumpsters } from "@/lib/data";

// Screen 8 (Dumpsters tab) — Asset Management.
export default function DumpstersPage() {
  const [open, setOpen] = useState(false);
  const dumpsters = getDumpsters();

  return (
    <>
      <Topbar
        title="Dumpsters"
        action={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" width={18} height={18} />
            Add Dumpster
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <Table>
            <THead>
              <TH>Dumpster ID</TH>
              <TH>Size</TH>
              <TH>Status</TH>
              <TH>Current Location</TH>
              <TH>AirTag ID</TH>
            </THead>
            <TBody>
              {dumpsters.map((d) => (
                <TR key={d.id}>
                  <TD className="font-semibold text-gray-900">{d.code}</TD>
                  <TD>{d.size}</TD>
                  <TD>
                    <DumpsterStatusBadge status={d.status} />
                  </TD>
                  <TD className="text-gray-500">{d.currentLocation}</TD>
                  <TD className="text-gray-500">{d.airTagId ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="px-5 py-3 text-sm text-gray-500 border-t border-gray-100">
            Total 22 dumpsters
          </div>
        </Card>
      </div>

      <AddDumpsterModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
