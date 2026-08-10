"use client";

import * as React from "react";
import { InvoiceModal } from "@/components/dispatcher/InvoiceModal";
import { Topbar } from "@/components/dispatcher/Topbar";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { Badge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/client-download";
import type { InvoiceRecord } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function InvoicesPage() {
  const { invoices } = useExpandedOperations();
  const { customers, canMutate } = useOperations();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InvoiceRecord>();
  const [exporting, setExporting] = React.useState(false);
  const receivables = invoices
    .filter((invoice) => !["paid", "closed", "void"].includes(invoice.status))
    .reduce((total, invoice) => total + invoice.amountCents, 0);

  const editInvoice = (invoice: InvoiceRecord) => {
    setEditing(invoice);
    setOpen(true);
  };

  const exportInvoices = async () => {
    setExporting(true);
    try {
      await downloadCsv("/api/exports/invoices", "invoices.csv");
      toast("Invoice CSV downloaded.", { tone: "success" });
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Invoice export could not be downloaded.",
        { tone: "error" },
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Invoices"
        action={
          <Button
            aria-label="New invoice"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New Invoice</span>
          </Button>
        }
      />
      <div className="portal-content portal-stack">
        <div className="portal-action-grid">
          <Metric
            label="Receivables"
            value={formatCurrency(receivables)}
          />
          <Metric
            label="Open Invoices"
            value={
              invoices.filter(
                (invoice) => !["closed", "void"].includes(invoice.status),
              ).length
            }
          />
        </div>

        <Card>
          <div className="flex justify-end border-b border-brand-ice p-4">
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              disabled={!canMutate || exporting}
              onClick={() => void exportInvoices()}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>

          <Table className="hidden lg:block">
            <THead>
              <TH>Invoice</TH>
              <TH>Customer</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Due</TH>
              <TH />
            </THead>
            <TBody>
              {invoices.map((invoice) => (
                <TR key={invoice.id}>
                  <TD className="font-semibold">{invoice.invoiceNumber}</TD>
                  <TD>
                    {customers.find(
                      (customer) => customer.id === invoice.customerId,
                    )?.name ?? "—"}
                  </TD>
                  <TD>{formatCurrency(invoice.amountCents)}</TD>
                  <TD>
                    <InvoiceStatus invoice={invoice} />
                  </TD>
                  <TD>{formatDate(invoice.dueDate)}</TD>
                  <TD>
                    <button
                      className="min-h-11 text-brand-blue"
                      onClick={() => editInvoice(invoice)}
                    >
                      Edit
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <ul className="divide-y divide-brand-ice/60 lg:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold text-brand-charcoal">
                      {invoice.invoiceNumber}
                    </h2>
                    <p className="mt-1 break-words text-sm text-brand-steel">
                      {customers.find(
                        (customer) => customer.id === invoice.customerId,
                      )?.name ?? "Unknown customer"}
                    </p>
                  </div>
                  <InvoiceStatus invoice={invoice} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <InvoiceValue
                    label="Amount"
                    value={formatCurrency(invoice.amountCents)}
                  />
                  <InvoiceValue
                    label="Due"
                    value={formatDate(invoice.dueDate)}
                  />
                </dl>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => editInvoice(invoice)}
                >
                  Edit Invoice
                </Button>
              </li>
            ))}
          </ul>

          {!invoices.length && (
            <p className="p-8 text-center text-brand-steel">No invoices yet.</p>
          )}
        </Card>
      </div>
      <InvoiceModal
        open={open}
        onClose={() => setOpen(false)}
        invoice={editing}
      />
    </>
  );
}

function InvoiceStatus({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Badge
      tone={
        invoice.status === "overdue"
          ? "amber"
          : ["paid", "closed"].includes(invoice.status)
            ? "green"
            : "blue"
      }
      label={invoice.status}
    />
  );
}

function InvoiceValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase text-brand-silver">{label}</dt>
      <dd className="mt-0.5 font-medium text-brand-charcoal">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="portal-card-pad">
      <div className="font-heading text-2xl font-bold min-[390px]:text-3xl">
        {value}
      </div>
      <div className="text-sm uppercase text-brand-steel">{label}</div>
    </Card>
  );
}
