"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { CustomerModal } from "@/components/dispatcher/CustomerModal";
import type { Customer } from "@/lib/types";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";

// Screen 9 — Customers.
export default function CustomersPage() {
  const { customers, deactivateCustomer, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [query,setQuery]=React.useState("");
  const [editing,setEditing]=React.useState<Customer|undefined>();
  const [open,setOpen]=React.useState(false);
  const visible=customers.filter(customer=>`${customer.name} ${customer.email} ${customer.phone} ${customer.address}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Topbar
        title="Customers"
        action={
          <Button aria-label="Add customer" onClick={()=>{setEditing(undefined);setOpen(true)}}>
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Customer</span>
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
              <Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search customers..." className="pl-10" />
            </div>
          </div>

          <Table className="hidden md:block">
            <THead>
              <TH>Customer</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH>Active Jobs</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {visible.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-brand-charcoal">{c.name}</TD>
                  <TD>{c.phone}</TD>
                  <TD className="text-brand-steel">{c.email}</TD>
                  <TD>{c.activeJobs}</TD>
                  <TD className="text-right">
                    <button onClick={()=>{setEditing(c);setOpen(true)}} aria-label={`Edit ${c.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center text-brand-steel hover:text-brand-blue">
                      <Icon name="edit" width={18} height={18} />
                    </button>
                    <button disabled={!canMutate || c.activeJobs > 0} title={c.activeJobs > 0 ? "Finish or cancel active jobs first" : "Deactivate customer"} onClick={async () => { if (!await confirm({ title: `Deactivate ${c.name}?`, message: "The customer will be removed from active operational lists. Audit history is retained.", confirmLabel: "Deactivate", tone: "danger" })) return; const result = await deactivateCustomer(c.id); toast(result.ok ? "Customer deactivated" : result.error.message, { tone: result.ok ? "success" : "error" }); }} aria-label={`Deactivate ${c.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600 disabled:text-brand-silver">
                      <Icon name="close" width={18} height={18} />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <ul className="divide-y divide-brand-ice/60 md:hidden">
            {visible.map((customer) => (
              <li key={customer.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-brand-charcoal">{customer.name}</h2>
                    <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="mt-2 flex min-h-11 items-center text-sm font-medium text-brand-blue">{customer.phone}</a>
                    <a href={`mailto:${customer.email}`} className="flex min-h-11 items-center break-all text-sm text-brand-blue">{customer.email}</a>
                  </div>
                  <span className="rounded bg-brand-mist px-2.5 py-1 text-xs font-semibold text-brand-steel">{customer.activeJobs} active</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Showing {visible.length} of {customers.length} customers
          </div>
        </Card>
      </div>
      <CustomerModal open={open} onClose={()=>setOpen(false)} customer={editing}/>
    </>
  );
}
