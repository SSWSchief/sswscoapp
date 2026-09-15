"use client";

import * as React from "react";
import { InvoiceModal } from "@/components/dispatcher/InvoiceModal";
import { Topbar } from "@/components/dispatcher/Topbar";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { Badge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/client-download";
import { apiErrorMessage } from "@/lib/client-api";
import type { InvoiceRecord } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type StripeReadiness = {
  configured: boolean;
  invoicingEnabled: boolean;
  mode: "test" | "live" | "unset";
};

export default function InvoicesPage() {
  const { invoices, refresh } = useExpandedOperations();
  const { customers, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InvoiceRecord>();
  const [exporting, setExporting] = React.useState(false);
  const [sending, setSending] = React.useState<string | null>(null);
  const [stripeReadiness, setStripeReadiness] =
    React.useState<StripeReadiness | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          data?: { stripe?: StripeReadiness };
        };
        if (body.data?.stripe) setStripeReadiness(body.data.stripe);
      })
      .catch(() => {
        // The send endpoint remains the authoritative fail-closed gate. A
        // health-read failure should not replace its actionable error with a
        // permanently disabled button and no recovery path.
      });
    return () => controller.abort();
  }, []);
  const receivables = invoices
    .filter((invoice) => !["paid", "void"].includes(invoice.status))
    .reduce((total, invoice) => total + invoice.amountRemainingCents, 0);

  const editInvoice = (invoice: InvoiceRecord) => {
    setEditing(invoice);
    setOpen(true);
  };

  /**
   * Raise the invoice in Stripe and mail it to the customer.
   *
   * The route is idempotent on the stored Stripe id, so a double click or an
   * impatient retry returns the existing payment link rather than billing the
   * customer twice.
   */
  const sendViaStripe = async (invoice: InvoiceRecord) => {
    setSending(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
      });
      if (!response.ok) {
        toast(
          await apiErrorMessage(response, "The invoice could not be sent."),
          { tone: "error" },
        );
        return;
      }
      toast(`${invoice.invoiceNumber} sent to the customer.`, { tone: "success" });
      await refresh();
    } catch {
      toast("The invoice could not be sent.", { tone: "error" });
    } finally {
      setSending(null);
    }
  };

  const deleteDraft = async (invoice: InvoiceRecord) => {
    const agreed = await confirm({
      title: `Delete ${invoice.invoiceNumber}?`,
      message: "This permanently removes the unsent draft and releases its completed jobs for another invoice. The invoice number will not be reused.",
      confirmLabel: "Delete draft",
      tone: "danger",
    });
    if (!agreed) return;
    setSending(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast(await apiErrorMessage(response, "The draft could not be deleted."), {
          tone: "error",
        });
        return;
      }
      toast(`${invoice.invoiceNumber} deleted.`, { tone: "success" });
      await refresh();
    } catch {
      toast("The draft could not be deleted.", { tone: "error" });
    } finally {
      setSending(null);
    }
  };

  const lifecycleAction = async (invoice: InvoiceRecord, action: "resend" | "revise" | "void" | "uncollectible" | "reconcile") => {
    // Void and write-off are the two irreversible money actions in this
    // ledger, so they get the same styled confirmation as every other
    // destructive action — a bare browser dialog reads as a page defect in
    // Home Screen mode, and said nothing about what the action costs.
    if (action === "void" || action === "uncollectible") {
      const voiding = action === "void";
      const agreed = await confirm({
        title: `${voiding ? "Void" : "Write off"} ${invoice.invoiceNumber}?`,
        message: voiding
          ? `This retires ${formatCurrency(invoice.amountRemainingCents)} in Stripe and here. The invoice cannot be reopened — issue a revision instead if the customer still owes it.`
          : `This marks ${formatCurrency(invoice.amountRemainingCents)} uncollectible. The debt stays on the ledger as written off rather than disappearing.`,
        confirmLabel: voiding ? "Void invoice" : "Write off",
        tone: "danger",
      });
      if (!agreed) return;
    }
    setSending(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/${action}`, { method: "POST" });
      if (!response.ok) { toast(await apiErrorMessage(response, "Invoice action failed."), { tone: "error" }); return; }
      toast(action === "revise" ? "Revision draft created." : `${invoice.invoiceNumber} updated.`, { tone: "success" });
      await refresh();
    } catch { toast("Invoice action failed.", { tone: "error" }); }
    finally { setSending(null); }
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
                (invoice) => !["paid", "void"].includes(invoice.status),
              ).length
            }
          />
        </div>

        {stripeReadiness && !stripeReadiness.invoicingEnabled && (
          <div
            role="status"
            className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <strong>Stripe sending is off.</strong>{" "}
            {stripeReadiness.configured
              ? `Stripe is connected in ${stripeReadiness.mode} mode, but invoice delivery has not been activated.`
              : "Stripe account or webhook configuration is incomplete."}{" "}
            You can create and delete drafts safely; activate approved billing before sending one to a customer.
          </div>
        )}

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
                  <TD>{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <button
                        className="min-h-11 text-brand-blue"
                        onClick={() => editInvoice(invoice)}
                      >
                        {invoice.status === "draft" ? "Edit" : "View"}
                      </button>
                      <StripeAction
                        invoice={invoice}
                        busy={sending === invoice.id}
                        disabled={!canMutate || stripeReadiness?.invoicingEnabled === false}
                        onSend={() => void sendViaStripe(invoice)}
                      />
                      {invoice.status === "draft" && !invoice.stripeInvoiceId && invoice.id !== "training-v1-invoice" && (
                        <button
                          className="min-h-11 text-red-700 disabled:opacity-40"
                          disabled={!canMutate || sending === invoice.id}
                          onClick={() => void deleteDraft(invoice)}
                        >
                          Delete
                        </button>
                      )}
                      <LifecycleActions invoice={invoice} busy={sending === invoice.id} onAction={(action) => void lifecycleAction(invoice, action)} />
                    </div>
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
                    value={invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  />
                </dl>
                <div className="mt-4 grid gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => editInvoice(invoice)}
                  >
                    {invoice.status === "draft" ? "Edit invoice" : "View invoice"}
                  </Button>
                  <StripeAction
                    invoice={invoice}
                    busy={sending === invoice.id}
                    disabled={!canMutate || stripeReadiness?.invoicingEnabled === false}
                    onSend={() => void sendViaStripe(invoice)}
                    full
                  />
                  {invoice.status === "draft" && !invoice.stripeInvoiceId && invoice.id !== "training-v1-invoice" && (
                    <Button
                      variant="danger"
                      disabled={!canMutate || sending === invoice.id}
                      onClick={() => void deleteDraft(invoice)}
                    >
                      Delete draft
                    </Button>
                  )}
                  <LifecycleActions invoice={invoice} busy={sending === invoice.id} onAction={(action) => void lifecycleAction(invoice, action)} full />
                </div>
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

/**
 * Drafts can be sent exactly once; finalized invoices expose Stripe links.
 */
function StripeAction({
  invoice,
  busy,
  disabled,
  onSend,
  full,
}: {
  invoice: InvoiceRecord;
  busy: boolean;
  disabled: boolean;
  onSend: () => void;
  full?: boolean;
}) {
  if (invoice.hostedInvoiceUrl)
    return (
      <a
        href={invoice.hostedInvoiceUrl}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex min-h-11 items-center justify-center text-brand-blue underline-offset-2 hover:underline ${full ? "w-full rounded border border-brand-ice" : ""}`}
      >
        Payment page
      </a>
    );
  if (invoice.stripeInvoiceId || invoice.status !== "draft") return null;
  return (
    <button
      className={`min-h-11 text-brand-blue disabled:opacity-40 ${full ? "w-full rounded border border-brand-ice" : ""}`}
      disabled={busy || disabled}
      onClick={onSend}
    >
      {busy ? "Sending…" : "Send via Stripe"}
    </button>
  );
}

function InvoiceStatus({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Badge
      tone={
        ["overdue", "payment_failed"].includes(invoice.displayStatus)
          ? "amber"
          : ["paid", "uncollectible"].includes(invoice.displayStatus)
            ? "green"
            : "blue"
      }
      label={invoice.displayStatus.replaceAll("_", " ")}
    />
  );
}

function LifecycleActions({ invoice, busy, onAction, full }: { invoice: InvoiceRecord; busy: boolean; onAction: (action: "resend" | "revise" | "void" | "uncollectible" | "reconcile") => void; full?: boolean }) {
  if (!invoice.stripeInvoiceId) return null;
  return <div className={`flex flex-wrap gap-2 ${full ? "justify-center" : ""}`}>
    {invoice.invoicePdfUrl && <a className="inline-flex min-h-11 items-center text-brand-blue" href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">PDF</a>}
    {invoice.status === "open" && <button className="min-h-11 text-brand-blue disabled:opacity-40" disabled={busy} onClick={() => onAction("resend")}>Resend</button>}
    {["open", "uncollectible"].includes(invoice.status) && !invoice.latestRevisionId && <button className="min-h-11 text-brand-blue disabled:opacity-40" disabled={busy} onClick={() => onAction("revise")}>Revise</button>}
    {invoice.status === "open" && <button className="min-h-11 text-brand-blue disabled:opacity-40" disabled={busy} onClick={() => onAction("void")}>Void</button>}
    {invoice.status === "open" && <button className="min-h-11 text-brand-blue disabled:opacity-40" disabled={busy} onClick={() => onAction("uncollectible")}>Write off</button>}
    {!["paid", "void"].includes(invoice.status) && <button className="min-h-11 text-brand-blue disabled:opacity-40" disabled={busy} onClick={() => onAction("reconcile")}>Refresh Stripe</button>}
  </div>;
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
