"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { CustomerModal } from "./CustomerModal";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { InvoiceBillingMode, InvoiceDraftItem, InvoiceLineCategory, InvoicePaymentTerms, InvoiceRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const categories: InvoiceLineCategory[] = ["service", "rental", "tonnage", "fee", "surcharge", "adjustment"];
const fuelEligibleServices = new Set(["Delivery", "Pick-Up", "Dump & Return", "Swap / Exchange", "Relocation", "Dry Run"]);
// `needsRate` is editor-only state: it drives the unpriced warning below and is
// deliberately absent from the payload `save()` builds, so it can never reach
// the ledger or Stripe.
type EditorItem = InvoiceDraftItem & { amount: string; key: string; needsRate?: boolean; fuelSurchargeEligible?: boolean };
type EligibleJob = { id: string; reference: string; serviceType: string; dumpsterSize: string; scheduledFor: string };
const blankItem = (): EditorItem => ({ description: "", amount: "", amountCents: 0, category: "service", jobId: null, key: crypto.randomUUID() });

export function InvoiceModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: InvoiceRecord }) {
  const { saveInvoice, settings, priceList, invoices } = useExpandedOperations();
  const { customers, jobs, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  // The name being created in CustomerModal, and the name awaiting resolution
  // back to an id once the operations cache has caught up.
  const [creatingCustomer, setCreatingCustomer] = React.useState<string | null>(null);
  const [pendingCustomer, setPendingCustomer] = React.useState<string | null>(null);
  const [billingMode, setBillingMode] = React.useState<InvoiceBillingMode>("per_job");
  const [jobIds, setJobIds] = React.useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = React.useState<InvoicePaymentTerms>("net_30");
  const [poNumber, setPoNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<EditorItem[]>([blankItem()]);
  const [catalogItemId, setCatalogItemId] = React.useState("");
  const [remoteJobs, setRemoteJobs] = React.useState<EligibleJob[] | null>(null);
  const [taxPreview, setTaxPreview] = React.useState<{
    taxCents: number;
    totalCents: number;
    rate?: number | null;
    ratePercent?: number | null;
    taxabilityReason?: string;
  } | null>(null);
  const [taxPreviewState, setTaxPreviewState] = React.useState<"idle" | "loading" | "error">("idle");
  const editable = !invoice || invoice.status === "draft";
  const jobSelectionEditable = editable && !invoice?.revisedFromId;

  React.useEffect(() => {
    if (!open) return;
    setCustomerId(invoice?.customerId ?? "");
    setCreatingCustomer(null);
    setPendingCustomer(null);
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

  React.useEffect(() => {
    if (!open || !editable || !selectedCustomer) {
      setTaxPreview(null);
      setTaxPreviewState("idle");
      return;
    }
    const address = selectedCustomer;
    const previewItems = items
      .map((item) => ({ id: item.key, amountCents: Math.round(Number(item.amount) * 100) }))
      .filter((item) => Number.isSafeInteger(item.amountCents) && item.amountCents > 0);
    if (!address.billingAddressLine1.trim() || !address.billingCity.trim() || !address.billingState.trim() || !address.billingPostalCode.trim() || !previewItems.length) {
      setTaxPreview(null);
      setTaxPreviewState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setTaxPreviewState("loading");
      void fetch("/api/invoices/tax-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          address: {
            line1: address.billingAddressLine1,
            line2: address.billingAddressLine2,
            city: address.billingCity,
            state: address.billingState,
            postalCode: address.billingPostalCode,
            country: address.billingCountry,
          },
          items: previewItems,
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Tax preview unavailable");
          const body = (await response.json()) as {
            data: { taxCents: number; totalCents: number; rate?: number | null; ratePercent?: number | null; taxabilityReason?: string };
          };
          setTaxPreview(body.data);
          setTaxPreviewState("idle");
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") {
            setTaxPreview(null);
            setTaxPreviewState("error");
          }
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editable, items, open, selectedCustomer]);
  // Derived rather than stored, so an existing invoice shows its customer
  // without the setup effect having to read the customer list.
  const customerFieldValue = selectedCustomer?.name ?? customerName;
  const taxRateLabelValue = taxPreview == null ? null : (taxPreview.ratePercent ?? taxPreview.rate ?? null);
  const taxRateLabel = taxRateLabelValue === null || taxRateLabelValue === undefined
    ? null
    : `${Number(taxRateLabelValue).toFixed(2).replace(/\.00$/, "")}%`;
  const taxabilityReasonLabel = taxPreview?.taxabilityReason?.replaceAll("_", " ");

  const matchCustomer = (name: string) =>
    customers.find((candidate) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase());

  const changeCustomerName = (name: string) => {
    setCustomerName(name);
    const match = matchCustomer(name);
    const nextId = match?.id ?? "";
    if (nextId === customerId) return;
    setCustomerId(nextId);
    setJobIds([]);
    setItems([blankItem()]);
  };

  /**
   * A name that matches nothing is an intent to create, not a typo to reject.
   * Confirm it, hand the full billing form the name, and come back with the
   * new customer selected — invoicing needs the billing contact and address
   * that form collects, so there is no lighter version of this step.
   */
  const offerToCreateCustomer = async () => {
    const name = customerName.trim();
    if (!name || matchCustomer(name)) return;
    const agreed = await confirm({
      title: `Create “${name}” as a new customer?`,
      message: "Invoices carry a reviewed billing contact and address, so the customer record has to exist before this invoice can be drafted.",
      confirmLabel: "Create customer",
      cancelLabel: "Keep editing",
    });
    if (agreed) setCreatingCustomer(name);
  };

  // The save resolves to no payload, so the new record is picked up by name as
  // soon as the refreshed list contains it.
  React.useEffect(() => {
    if (!pendingCustomer) return;
    const match = customers.find(
      (candidate) => candidate.name.trim().toLowerCase() === pendingCustomer.trim().toLowerCase(),
    );
    if (!match) return;
    setCustomerId(match.id);
    setCustomerName(match.name);
    setJobIds([]);
    setItems([blankItem()]);
    setPendingCustomer(null);
  }, [pendingCustomer, customers]);
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
    if (!job) return;
    const rate = priceList.find((candidate) => candidate.serviceType === job.serviceType && candidate.dumpsterSize === job.dumpsterSize);
    setItems((current) => {
      const firstBlank = current.findIndex((item) => !item.description.trim() && !item.amount.trim());
      // A job with no matching price-list rate still gets its own line — with
      // the amount left for the office to fill in — rather than silently
      // disappearing while the job is marked invoiced. The description stays
      // identical either way: it is copied verbatim onto the Stripe line item
      // the customer reads, so the "needs a price" signal belongs in the
      // editor's own chrome, never in the billed text.
      const description = `${job.serviceType} · ${job.dumpsterSize} · ${job.reference}`;
      const suggested = rate
        ? { description, amount: (rate.priceCents / 100).toFixed(2), amountCents: rate.priceCents, category: "service" as const, jobId, key: crypto.randomUUID(), fuelSurchargeEligible: fuelEligibleServices.has(rate.serviceType) }
        : { description, amount: "", amountCents: 0, category: "service" as const, jobId, key: crypto.randomUUID(), needsRate: true };
      return firstBlank >= 0 ? current.map((item, index) => index === firstBlank ? suggested : item) : [...current, suggested];
    });
  };

  const updateItem = (index: number, patch: Partial<EditorItem>) =>
    setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));

  const addCatalogLine = (id: string) => {
    setCatalogItemId("");
    const rate = priceList.find((item) => item.id === id);
    if (!rate) return;
    const firstBlank = items.findIndex((item) => !item.description.trim() && !item.amount.trim());
    const line: EditorItem = {
      description: `${rate.dumpsterSize} ${rate.serviceType}`,
      amountCents: rate.priceCents,
      amount: (rate.priceCents / 100).toFixed(2),
      category: "service",
      jobId: null,
      key: crypto.randomUUID(),
      // These price-list entries are the rental and transport services in the
      // approved surcharge policy; disposal/tonnage/fee lines are excluded.
      fuelSurchargeEligible: fuelEligibleServices.has(rate.serviceType),
    };
    setItems((current) => firstBlank >= 0
      ? current.map((item, index) => index === firstBlank ? line : item)
      : [...current, line]);
  };

  const addFuelSurcharge = () => {
    const eligible = items.filter((item) => item.fuelSurchargeEligible);
    const basisCents = eligible.reduce((sum, item) => sum + (Math.round(Number(item.amount) * 100) || 0), 0);
    if (basisCents <= 0) {
      toast("Add a rental or transport catalog line before calculating the fuel recovery fee.", { tone: "error" });
      return;
    }
    const surcharge: EditorItem = {
      description: `Fuel & Environmental Recovery Fee (5% of ${formatCurrency(basisCents)})`,
      amountCents: Math.round(basisCents * 0.05),
      amount: (Math.round(basisCents * 0.05) / 100).toFixed(2),
      category: "surcharge",
      jobId: null,
      key: crypto.randomUUID(),
    };
    setItems((current) => [
      ...current.filter((item) => !item.description.startsWith("Fuel & Environmental Recovery Fee (5% of ")),
      surcharge,
    ]);
  };

  const changeBillingMode = (mode: InvoiceBillingMode) => {
    setBillingMode(mode);
    if (mode === "one_off") {
      // A one-off must carry no jobs at all, so switching to it drops both the
      // selections and the job attribution on any line already entered.
      setJobIds([]);
      setItems((lines) => lines.map((line) => line.jobId ? { ...line, jobId: null } : line));
      return;
    }
    if (mode !== "per_job") return;
    const kept = jobIds.slice(0, 1);
    setJobIds(kept);
    setItems((lines) => lines.map((line) => line.jobId && !kept.includes(line.jobId) ? { ...line, jobId: null } : line));
  };

  const save = async () => {
    // A typed-but-unmatched name at save time means the create step was
    // dismissed or skipped. Re-offer it instead of failing with a generic
    // "select completed work" message that says nothing about the real cause.
    if (!customerId && customerName.trim()) {
      await offerToCreateCustomer();
      return;
    }
    const normalized = items.map((item) => ({
      description: item.description.trim(),
      amountCents: Math.round(Number(item.amount) * 100),
      jobId: item.jobId || null,
      category: item.category,
    }));
    const total = normalized.reduce((sum, item) => sum + item.amountCents, 0);
    if (!customerId || (billingMode !== "one_off" && !jobIds.length) || total <= 0 || !Number.isSafeInteger(total) || normalized.some((item) => !item.description || !Number.isSafeInteger(item.amountCents) || item.amountCents === 0)) {
      toast(billingMode === "one_off"
      ? "Describe each line, use non-zero amounts, and keep the invoice total positive."
      : "Select completed work, use non-zero line amounts, and keep the invoice total positive.", { tone: "error" }); return;
    }
    // Every attached job is retired from the eligible list once this saves,
    // whether or not anything billed it. A statement whose single line covers
    // several pulls is legitimate, so this warns rather than refuses — but it
    // never lets a job go silently uninvoiced-yet-unavailable.
    const billedJobs = new Set(normalized.map((item) => item.jobId).filter(Boolean));
    const unbilled = billingMode === "one_off" ? [] : jobIds.filter((jobId) => !billedJobs.has(jobId));
    if (unbilled.length) {
      const names = unbilled.map((jobId) => eligibleJobs.find((job) => job.id === jobId)?.reference ?? jobId);
      const agreed = await confirm({
        title: unbilled.length === 1 ? `${names[0]} has no line of its own` : `${unbilled.length} jobs have no line of their own`,
        message: `${names.join(", ")} will be marked invoiced and will not be offered on another invoice. Continue only if a line above already covers the work.`,
        confirmLabel: "Save anyway",
        cancelLabel: "Go back",
        tone: "danger",
      });
      if (!agreed) return;
    }
    setBusy(true);
    const result = await saveInvoice({ customerId, billingMode, jobIds, paymentTerms, poNumber, notes, items: normalized }, invoice?.id);
    setBusy(false);
    toast(result.ok ? "Invoice draft saved" : result.error.message, { tone: result.ok ? "success" : "error" });
    if (result.ok) onClose();
  };

  return (
    <>
    <Modal open={open && !creatingCustomer} onClose={onClose} title={invoice ? `${editable ? "Edit" : "View"} ${invoice.invoiceNumber}` : "New invoice draft"} widthClass="max-w-5xl" footer={<><Button variant="secondary" onClick={onClose}>{editable ? "Cancel" : "Close"}</Button>{editable && <Button disabled={busy || !canMutate} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</Button>}</>}>
      <div className="space-y-5">
        {!editable && <div className="rounded border border-brand-ice bg-brand-mist p-3 text-sm text-brand-steel">This invoice is finalized and read-only. Use a revision for corrections.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Invoice number" hint="Assigned automatically and never reused."><Input readOnly value={invoice?.invoiceNumber ?? "Assigned when saved"} /></FormField>
          <FormField label="Billing mode">
            <Select disabled={!jobSelectionEditable} value={billingMode} onChange={(event) => changeBillingMode(event.target.value as InvoiceBillingMode)}>
              <option value="per_job">Per job</option><option value="statement">Multi-job statement</option><option value="one_off">One-off (no job)</option>
            </Select>
          </FormField>
          <FormField label="Customer" required hideRequiredMark hint={editable && !invoice ? "Pick an existing customer or type a new name." : undefined}>
            <Input
              list="invoice-customers"
              disabled={!editable || Boolean(invoice)}
              placeholder="Customer name"
              value={customerFieldValue}
              onChange={(event) => changeCustomerName(event.target.value)}
              onBlur={() => void offerToCreateCustomer()}
            />
          </FormField>
          {/* Outside the field: FormField clones its single child to carry the
              id the label points at, so wrapping the input would hang the
              label off a div instead of the control. */}
          <datalist id="invoice-customers">
            {customers.map((customer) => <option key={customer.id} value={customer.name} />)}
          </datalist>
          <FormField label="Payment terms"><Select disabled={!editable} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value as InvoicePaymentTerms)}><option value="due_on_receipt">Due on receipt</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option></Select></FormField>
        </div>
        {selectedCustomer && <div className="rounded border border-brand-ice p-3 text-sm"><div className="font-semibold">Recipient review</div><div>{selectedCustomer.billingContactName || "Missing contact"} · {selectedCustomer.billingEmail || "Missing email"}</div><div className="text-brand-steel">{[selectedCustomer.billingAddressLine1, selectedCustomer.billingCity, selectedCustomer.billingState, selectedCustomer.billingPostalCode].filter(Boolean).join(", ") || "Billing address incomplete"}</div></div>}
        {/* Austin asked for no asterisks anywhere in invoicing. Both fields stay
            required for validation and assistive technology. */}
        {billingMode === "one_off" ? (
          <div className="rounded border border-brand-ice bg-brand-mist p-3 text-sm text-brand-steel">
            A one-off invoice bills its line items directly, with no completed job behind it. Use it for a charge that never was a job, or for a customer with no job history yet.
          </div>
        ) : (
        <FormField label={billingMode === "statement" ? "Completed jobs" : "Completed job"} required hideRequiredMark>
          <div className="max-h-40 space-y-2 overflow-auto rounded border border-brand-ice p-3">
            {eligibleJobs.map((job) => <label key={job.id} className="flex min-h-8 items-center gap-2"><input disabled={!jobSelectionEditable} type={billingMode === "per_job" ? "radio" : "checkbox"} name="invoice-job" checked={jobIds.includes(job.id)} onChange={(event) => selectJob(job.id, event.target.checked)} /><span>{job.reference} · {job.serviceType} · {job.dumpsterSize}</span></label>)}
            {!eligibleJobs.length && <span className="text-sm text-brand-steel">No uninvoiced completed jobs for this customer. Switch to a one-off invoice to bill without one.</span>}
          </div>
        </FormField>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-heading font-semibold">Line items</h3>
            <span className="text-xs text-brand-steel">{items.length} {items.length === 1 ? "line" : "lines"}</span>
          </div>
          <div className="space-y-3">{items.map((item, index) => <div key={item.key} className="grid gap-2 rounded border border-brand-ice p-3 lg:grid-cols-[minmax(12rem,1fr)_9rem_9rem_auto]">
            <Input aria-label={`Line ${index + 1} description`} disabled={!editable} placeholder="Description" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} />
            <div>
              <Input aria-label={`Line ${index + 1} amount`} disabled={!editable} type="number" step="0.01" placeholder="Amount" aria-describedby={item.needsRate && !item.amount.trim() ? `${item.key}-rate` : undefined} value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} />
              {item.needsRate && !item.amount.trim() && (
                <p id={`${item.key}-rate`} className="mt-1 text-xs text-red-600">No rate on file — enter an amount.</p>
              )}
            </div>
            <Select aria-label={`Line ${index + 1} category`} disabled={!editable} value={item.category} onChange={(event) => updateItem(index, { category: event.target.value as InvoiceLineCategory })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
            {editable && <button className="min-h-11 px-2 text-red-700 disabled:opacity-40" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Remove</button>}
          </div>)}</div>
          {/* The add control sits under the last line rather than up in the
              header: that is where the eye and the cursor already are after
              filling one in, and on a long statement the header scrolls away
              entirely. Dashed and full-width so it reads as "there is room for
              another one here" instead of as a second toolbar button. */}
          {editable && (
            <button
              type="button"
              onClick={() => setItems((current) => [...current, blankItem()])}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded border-2 border-dashed border-brand-blue/40 bg-brand-mist/40 px-4 font-heading text-sm font-semibold uppercase tracking-wide text-brand-blue transition-colors hover:border-brand-blue hover:bg-brand-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1"
            >
              <Icon name="plus" width={16} height={16} />
              Add line
            </button>
          )}
          {editable && priceList.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select aria-label="Add priced catalog line" value={catalogItemId} onChange={(event) => addCatalogLine(event.target.value)}>
                <option value="">Add priced rental or transport line…</option>
                {priceList.map((item) => <option key={item.id} value={item.id}>{item.dumpsterSize} {item.serviceType} · {formatCurrency(item.priceCents)}</option>)}
              </Select>
              <Button type="button" variant="secondary" onClick={addFuelSurcharge}>Add 5% fuel fee</Button>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-brand-ice pt-3">
            <span className="text-sm text-brand-steel">Subtotal before tax</span>
            <span className="font-heading text-lg font-semibold">{formatCurrency(items.reduce((sum, item) => sum + (Math.round(Number(item.amount) * 100) || 0), 0))}</span>
          </div>
          {editable && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-brand-steel">Estimated sales tax</span>
              <span className="font-medium text-brand-charcoal">
                {taxPreviewState === "loading"
                  ? "Calculating…"
                  : taxPreview
                    ? `${taxRateLabel ?? "Tax"} · ${formatCurrency(taxPreview.taxCents)} · Total ${formatCurrency(taxPreview.totalCents)}${taxabilityReasonLabel ? ` · ${taxabilityReasonLabel}` : ""}`
                    : taxPreviewState === "error"
                      ? "Unavailable — Stripe calculates at send"
                      : "Enter billing details to calculate"}
              </span>
            </div>
          )}
        </div>
        <FormField label="Notes"><Textarea disabled={!editable} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
        {!editable && <div className="grid gap-2 text-sm sm:grid-cols-2"><div>Subtotal: <strong>{formatCurrency(invoice?.subtotalCents ?? 0)}</strong></div><div>Tax: <strong>{formatCurrency(invoice?.taxCents ?? 0)}</strong></div><div>Total: <strong>{formatCurrency(invoice?.amountCents ?? 0)}</strong></div><div>Canonical status: <strong>{invoice?.status}</strong></div><div>Display status: <strong>{invoice?.displayStatus.replaceAll("_", " ")}</strong></div><div>Paid: <strong>{formatCurrency(invoice?.amountPaidCents ?? 0)}</strong></div><div>Remaining: <strong>{formatCurrency(invoice?.amountRemainingCents ?? 0)}</strong></div></div>}
      </div>
    </Modal>
    {/* Swapped in rather than stacked on top: both dialogs use the same z-index
        and share a window-level Escape handler, so one Escape would close both
        and the two focus traps would fight. The invoice editor stays mounted,
        so every line already entered is still there on the way back. */}
    <CustomerModal
      open={Boolean(creatingCustomer)}
      initialName={creatingCustomer ?? undefined}
      onClose={() => setCreatingCustomer(null)}
      onSaved={(name) => setPendingCustomer(name)}
    />
    </>
  );
}
