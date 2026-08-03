import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getCustomers } from "@/lib/data";

// Screen 9 — Customers.
export default function CustomersPage() {
  const customers = getCustomers();

  return (
    <>
      <Topbar
        title="Customers"
        action={
          <Button aria-label="Add customer">
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Customer</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card>
          <div className="p-5 border-b border-brand-ice/60">
            <div className="relative max-w-md">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
              <Input placeholder="Search customers..." className="pl-10" />
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
              {customers.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-brand-charcoal">{c.name}</TD>
                  <TD>{c.phone}</TD>
                  <TD className="text-brand-steel">{c.email}</TD>
                  <TD>{c.activeJobs}</TD>
                  <TD className="text-right">
                    <button aria-label={`View ${c.name}`} className="inline-flex min-h-11 min-w-11 items-center justify-center text-brand-steel hover:text-brand-blue">
                      <Icon name="eye" width={18} height={18} />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <ul className="divide-y divide-brand-ice/60 md:hidden">
            {customers.map((customer) => (
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
            Showing 1 to {customers.length} of 24 customers
          </div>
        </Card>
      </div>
    </>
  );
}
