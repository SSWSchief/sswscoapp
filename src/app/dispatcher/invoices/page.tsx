import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getCustomer, getInvoices } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default function InvoicesPage() {
  const invoices = getInvoices();
  const open = invoices.filter((i) => !["paid", "closed"].includes(i.status));
  const totalOpen = open.reduce((sum, i) => sum + i.amount, 0);

  return (
    <>
      <Topbar title="Invoices" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Metric label="Receivables" value={`$${totalOpen.toLocaleString()}`} />
          <Metric label="Open Invoices" value={open.length} />
          <Metric label="Payment Integration" value="Discovery" />
        </div>

        <Card>
          <CardHeader title="Receivables & Payment Links" />
          <Table className="hidden lg:block">
            <THead>
              <TH>Invoice</TH>
              <TH>Customer</TH>
              <TH>Group</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Reminder</TH>
              <TH>Due</TH>
              <TH>Link</TH>
            </THead>
            <TBody>
              {invoices.map((invoice) => {
                const customer = getCustomer(invoice.customerId);
                return (
                  <TR key={invoice.id}>
                    <TD className="font-semibold">{invoice.invoiceNumber}</TD>
                    <TD>{customer?.name}</TD>
                    <TD>{invoice.customerGroup}</TD>
                    <TD>${invoice.amount.toLocaleString()}</TD>
                    <TD>
                      <Badge
                        tone={invoice.status === "overdue" ? "amber" : invoice.status === "paid" || invoice.status === "closed" ? "green" : "blue"}
                        label={invoice.status}
                      />
                    </TD>
                    <TD>{invoice.reminderCadence}</TD>
                    <TD>{formatDate(invoice.dueAt)}</TD>
                    <TD>
                      <a className="inline-flex min-h-11 items-center text-brand-blue hover:underline" href={invoice.paymentUrl} target="_blank" rel="noreferrer">
                        Payment URL
                      </a>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <ul className="divide-y divide-brand-ice/60 lg:hidden">
            {invoices.map((invoice) => {
              const customer = getCustomer(invoice.customerId);
              return (
                <li key={invoice.id} className="p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-brand-charcoal">{invoice.invoiceNumber}</h3><p className="mt-0.5 text-sm text-brand-steel">{customer?.name}</p></div><Badge tone={invoice.status === "overdue" ? "amber" : invoice.status === "paid" || invoice.status === "closed" ? "green" : "blue"} label={invoice.status} /></div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs uppercase text-brand-silver">Amount</dt><dd className="mt-0.5 font-semibold text-brand-charcoal">${invoice.amount.toLocaleString()}</dd></div><div><dt className="text-xs uppercase text-brand-silver">Due</dt><dd className="mt-0.5 text-brand-charcoal">{formatDate(invoice.dueAt)}</dd></div></dl>
                  <a className="mt-3 flex min-h-11 items-center font-medium text-brand-blue" href={invoice.paymentUrl} target="_blank" rel="noreferrer">Open Payment Link <span aria-hidden="true">↗</span></a>
                </li>
              );
            })}
          </ul>
          <p className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
            Payment processor and bank deposit behavior are placeholders pending discovery.
          </p>
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="font-heading text-3xl font-bold text-brand-charcoal">{value}</div>
      <div className="font-heading text-sm uppercase tracking-wide text-brand-steel">{label}</div>
    </Card>
  );
}
