"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { InvoiceBillingMode, InvoiceDraftItem, InvoiceLineCategory, InvoicePaymentTerms, InvoiceRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const categories: InvoiceLineCategory[] = ["service", "rental", "tonnage", "fee", "surcharge", "adjustment"];
type EditorItem = InvoiceDraftItem & { amount: string; key: string };
type EligibleJob = { id: string; reference: string; serviceType: string; dumpsterSize: string; scheduledFor: string };
const blankItem = (): EditorItem => ({ description: "", amount: "", amountCents: 0, category: "service", jobId: null, key: crypto.randomUUID() });

export function InvoiceModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: InvoiceRecord }) {
  const { saveInvoice, settings, priceList, invoices } = useExpandedOperations();
  const { customers, jobs, canMutate } = useOperations();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [billingMode, setBillingMode] = React.useState<InvoiceBillingMode>("per_job");
  const [jobIds, setJobIds] = React.useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = React.useState<InvoicePaymentTerms>("net_30");
  const [poNumber, setPoNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<EditorItem[]>([blankItem()]);
  const [remoteJobs, setRemoteJobs] = React.useState<EligibleJob[] | null>(null);
  const editable = !invoice || invoice.status === "draft";
  const jobSelectionEditable = editable && !invoice?.revisedFromId;

  React.useEffect(() => {
    if (!open) return;
    setCustomerId(invoice?.customerId ?? "");
    setBillingMode(invoice?.billingMode ?? "per_job");
    setJobIds(invoice?.jobIds ?? []);
    setPaymentTerms(invoice?.paymentTerms ?? settings?.defaultPaymentTerms ?? "net_30");
    setPoNumber(invoice?.poNumber ?? "");
    setNotes(invoice?.notes ?? "");
    setItems(invoice?.lineItems.length
      ? invoice.lineItems.map((item) => ({ description: item.description, amountCents: item.amountCents, amount: (item.amountCents / 100).toFixed(2), jobId: item.jobId, category: item.category, key: item.id }))
      : [blankItem()]);
  }, [open, invoice, settings]);

  React.useEffect(() => {
    if (!open || !customerId) { setRemoteJobs(null); return; }
    const controller = new AbortController();
    const query = new URLSearchParams({ customerId });
    if (invoice?.id) query.set("invoiceId", invoice.id);
    void fetch(`/api/invoices/eligible-jobs?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Eligible jobs could not be loaded.");
        const body = (await response.json()) as { data: EligibleJob[] };
        setRemoteJobs(body.data);
      })
      .catch((error) => { if ((error as Error).name !== "AbortError") setRemoteJobs(null); });
    return () => controller.abort();
  }, [open, customerId, invoice?.id]);

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const unavailableJobs = new Set(invoices.filter((candidate) => candidate.id !== invoice?.id && candidate.status !== "void").flatMap((candidate) => candidate.jobIds));
  const localEligibleJobs = jobs.filter((job) => job.customerId === customerId && job.status === "complete" && !unavailableJobs.has(job.id));
  const eligibleJobs = remoteJobs ?? localEligibleJobs;

  const selectJob = (jobId: string, checked: boolean) => {
    if (billingMode === "per_job") {
      setJobIds(checked ? [jobId] : []);
      if (checked) setItems((current) => current.map((item) => item.jobId && item.jobId !== jobId ? { ...item, jobId: null } : item));
    } else setJobIds((current) => checked ? [...current, jobId] : current.filter((id) => id !== jobId));
    if (!checked) {
      setItems((current) => current.map((item) => item.jobId === jobId ? { ...item, jobId: null } : item));
      return;
    }
    const job = eligibleJobs.find((candidate) => candidate.id === jobId);
    const rate = job && priceList.find((candidate) => candidate.serviceType === job.serviceType && candidate.dumpsterSize === job.dumpsterSize);
    if (!job || !rate) return;
    setItems((current) => {
      const firstBlank = current.findIndex((item) => !item.description.trim() && !item.amount.trim());
      const suggested = { description: `${job.serviceType} · ${job.dumpsterSize} · ${job.reference}`, amount: (rate.priceCents / 100).toFixed(2), amountCents: rate.priceCents, category: "service" as const, jobId, key: crypto.randomUUID() };
      return firstBlank >= 0 ? current.map((item, index) => index === firstBlank ? suggested : item) : [...current, suggested];
    });
  };

  const updateItem = (index: number, patch: Partial<EditorItem>) =>
    setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));

  const changeBillingMode = (mode: InvoiceBillingMode) => {
    setBillingMode(mode);
    if (mode !== "per_job") return;
    const kept = jobIds.slice(0, 1);
    setJobIds(kept);
    setItems((lines) => lines.map((line) => line.jobId && !kept.includes(line.jobId) ? { ...line, jobId: null } : line));
  };

  const save = async () => {
    const normalized = items.map((item) => ({
      description: item.description.trim(),
      amountCents: Math.round(Number(item.amount) * 100),
      jobId: item.jobId || null,
      category: item.category,
    }));
    const total = normalized.reduce((sum, item) => sum + item.amountCents, 0);
    if (!customerId || !jobIds.length || total <= 0 || !Number.isSafeInteger(total) || normalized.some((item) => !item.description || !Number.isSafeInteger(item.amountCents) || item.amountCents === 0)) {
      toast("Select completed work, use non-zero line amounts, and keep the invoice total positive.", { tone: "error" }); return;
    }
    setBusy(true);
    const result = await saveInvoice({ customerId, billingMode, jobIds, paymentTerms, poNumber, notes, items: normalized }, invoice?.id);
    setBusy(false);
    toast(result.ok ? "Invoice draft saved" : result.error.message, { tone: result.ok ? "success" : "error" });
    if (result.ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={invoice ? `${editable ? "Edit" : "View"} ${invoice.invoiceNumber}` : "New invoice draft"} footer={<><Button variant="secondary" onClick={onClose}>{editable ? "Cancel" : "Close"}</Button>{editable && <Button disabled={busy || !canMutate} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</Button>}</>}>
      <div className="space-y-5">
        {!editable && <div className="rounded border border-brand-ice bg-brand-mist p-3 text-sm text-brand-steel">This invoice is finalized and read-only. Use a revision for corrections.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Invoice number" hint="Assigned automatically and never reused."><Input readOnly value={invoice?.invoiceNumber ?? "Assigned when saved"} /></FormField>
          <FormField label="Billing mode">
            <Select disabled={!jobSelectionEditable} value={billingMode} onChange={(event) => changeBillingMode(event.target.value as InvoiceBillingMode)}>
              <option value="per_job">Per job</option><option value="statement">Multi-job statement</option>
            </Select>
          </FormField>
          <FormField label="Customer" required><Select disabled={!editable || Boolean(invoice)} value={customerId} onChange={(event) => { setCustomerId(event.target.value); setJobIds([]); setItems([blankItem()]); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</Select></FormField>
          <FormField label="Payment terms"><Select disabled={!editable} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value as InvoicePaymentTerms)}><option value="due_on_receipt">Due on receipt</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option></Select></FormField>
        </div>
        {selectedCustomer && <div className="rounded border border-brand-ice p-3 text-sm"><div className="font-semibold">Recipient review</div><div>{selectedCustomer.billingContactName || "Missing contact"} · {selectedCustomer.billingEmail || "Missing email"}</div><div className="text-brand-steel">{[selectedCustomer.billingAddressLine1, selectedCustomer.billingCity, selectedCustomer.billingState, selectedCustomer.billingPostalCode].filter(Boolean).join(", ") || "Billing address incomplete"}</div></div>}
        <FormField label={billingMode === "statement" ? "Completed jobs" : "Completed job"} required>
          <div className="max-h-40 space-y-2 overflow-auto rounded border border-brand-ice p-3">
            {eligibleJobs.map((job) => <label key={job.id} className="flex min-h-8 items-center gap-2"><input disabled={!jobSelectionEditable} type={billingMode === "per_job" ? "radio" : "checkbox"} name="invoice-job" checked={jobIds.includes(job.id)} onChange={(event) => selectJob(job.id, event.target.checked)} /><span>{job.reference} · {job.serviceType} · {job.dumpsterSize}</span></label>)}
            {!eligibleJobs.length && <span className="text-sm text-brand-steel">No uninvoiced completed jobs for this customer.</span>}
          </div>
        </FormField>
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="font-heading font-semibold">Line items</h3>{editable && <Button variant="secondary" onClick={() => setItems((current) => [...current, blankItem()])}>Add line</Button>}</div>
          <div className="space-y-3">{items.map((item, index) => <div key={item.key} className="grid gap-2 rounded border border-brand-ice p-3 sm:grid-cols-[1fr_9rem_9rem_9rem_auto]">
            <Input aria-label={`Line ${index + 1} description`} disabled={!editable} placeholder="Description" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} />
            <Input aria-label={`Line ${index + 1} amount`} disabled={!editable} type="number" step="0.01" placeholder="Amount" value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} />
            <Select aria-label={`Line ${index + 1} category`} disabled={!editable} value={item.category} onChange={(event) => updateItem(index, { category: event.target.value as InvoiceLineCategory })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
            <Select aria-label={`Line ${index + 1} source job`} disabled={!editable} value={item.jobId ?? ""} onChange={(event) => updateItem(index, { jobId: event.target.value || null })}><option value="">General</option>{jobIds.map((jobId) => <option key={jobId} value={jobId}>{eligibleJobs.find((job) => job.id === jobId)?.reference ?? jobId}</option>)}</Select>
            {editable && <button className="min-h-11 px-2 text-red-700 disabled:opacity-40" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Remove</button>}
          </div>)}</div>
          <div className="mt-2 text-right font-semibold">Total: {formatCurrency(items.reduce((sum, item) => sum + (Math.round(Number(item.amount) * 100) || 0), 0))}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="PO number"><Input disabled={!editable} maxLength={140} value={poNumber} onChange={(event) => setPoNumber(event.target.value)} /></FormField><div /></div>
        <FormField label="Notes"><Textarea disabled={!editable} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
        {!editable && <div className="grid gap-2 text-sm sm:grid-cols-2"><div>Canonical status: <strong>{invoice?.status}</strong></div><div>Display status: <strong>{invoice?.displayStatus.replaceAll("_", " ")}</strong></div><div>Paid: <strong>{formatCurrency(invoice?.amountPaidCents ?? 0)}</strong></div><div>Remaining: <strong>{formatCurrency(invoice?.amountRemainingCents ?? 0)}</strong></div></div>}
      </div>
    </Modal>
  );
}
