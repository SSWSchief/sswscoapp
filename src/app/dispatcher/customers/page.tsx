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
          <Button>
            <Icon name="plus" width={18} height={18} />
            Add Customer
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
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

          <Table>
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
                    <button className="text-brand-steel hover:text-brand-blue inline-flex">
                      <Icon name="eye" width={18} height={18} />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Showing 1 to {customers.length} of 24 customers
          </div>
        </Card>
      </div>
    </>
  );
}
