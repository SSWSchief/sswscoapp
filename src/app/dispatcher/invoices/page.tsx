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
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Receivables" value={`$${totalOpen.toLocaleString()}`} />
          <Metric label="Open Invoices" value={open.length} />
          <Metric label="Payment Integration" value="Discovery" />
        </div>

        <Card>
          <CardHeader title="Receivables & Payment Links" />
          <Table>
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
                      <a className="text-brand-blue hover:underline" href={invoice.paymentUrl}>
                        Payment URL
                      </a>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
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
