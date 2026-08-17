"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { VendorModal } from "@/components/dispatcher/VendorModal";
import type { Vendor } from "@/lib/types";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";

export default function VendorsPage() {
  const { vendors, deactivateVendor, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Vendor | undefined>();
  const [open, setOpen] = React.useState(false);
  const visible = vendors.filter((vendor) =>
    `${vendor.name} ${vendor.category} ${vendor.phone} ${vendor.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <>
      <Topbar
        title="Vendors"
        action={
          <Button
            aria-label="Add vendor"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Vendor</span>
          </Button>
        }
      />

      <div className="portal-content">
        <Card>
          <div className="p-5 border-b border-brand-ice/60">
            <div className="relative max-w-md">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search vendors..."
                className="pl-10"
              />
            </div>
          </div>

          <Table className="hidden md:block">
            <THead>
              <TH>Vendor</TH>
              <TH>Category</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {visible.map((v) => (
                <TR key={v.id}>
                  <TD className="font-medium text-brand-charcoal">{v.name}</TD>
                  <TD className="text-brand-steel">{v.category}</TD>
                  <TD>
                    {v.phone ? (
                      <a
                        href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}
                        className="text-brand-blue"
                      >
                        {v.phone}
                      </a>
                    ) : (
                      <span className="text-brand-silver">—</span>
                    )}
                  </TD>
                  <TD className="text-brand-steel">
                    {v.email ? (
                      <a href={`mailto:${v.email}`} className="text-brand-blue">
                        {v.email}
                      </a>
                    ) : (
                      <span className="text-brand-silver">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <button
                      onClick={() => {
                        setEditing(v);
                        setOpen(true);
                      }}
                      aria-label={`Edit ${v.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-brand-steel hover:text-brand-blue"
                    >
                      <Icon name="edit" width={18} height={18} />
                    </button>
                    <button
                      disabled={!canMutate}
                      title="Deactivate vendor"
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: `Deactivate ${v.name}?`,
                            message:
                              "The vendor will be removed from the contact list. Audit history is retained.",
                            confirmLabel: "Deactivate",
                            tone: "danger",
                          }))
                        )
                          return;
                        const result = await deactivateVendor(v.id);
                        toast(
                          result.ok ? "Vendor deactivated" : result.error.message,
                          { tone: result.ok ? "success" : "error" },
                        );
                      }}
                      aria-label={`Deactivate ${v.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600 disabled:text-brand-silver"
                    >
                      <Icon name="close" width={18} height={18} />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <ul className="divide-y divide-brand-ice/60 md:hidden">
            {visible.map((vendor) => (
              <li key={vendor.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-brand-charcoal">
                      {vendor.name}
                    </h2>
                    {vendor.phone && (
                      <a
                        href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`}
                        className="mt-2 flex min-h-11 items-center text-sm font-medium text-brand-blue"
                      >
                        {vendor.phone}
                      </a>
                    )}
                    {vendor.email && (
                      <a
                        href={`mailto:${vendor.email}`}
                        className="flex min-h-11 items-center break-all text-sm text-brand-blue"
                      >
                        {vendor.email}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {vendor.category && (
                      <span className="rounded bg-brand-mist px-2.5 py-1 text-xs font-semibold text-brand-steel">
                        {vendor.category}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditing(vendor);
                        setOpen(true);
                      }}
                      aria-label={`Edit ${vendor.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-brand-steel hover:text-brand-blue"
                    >
                      <Icon name="edit" width={18} height={18} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Showing {visible.length} of {vendors.length} vendors
          </div>
        </Card>
      </div>
      <VendorModal open={open} onClose={() => setOpen(false)} vendor={editing} />
    </>
  );
}
