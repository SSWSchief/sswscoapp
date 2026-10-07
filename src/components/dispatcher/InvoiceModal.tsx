"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { Customer, InvoiceBillingInput, InvoiceBillingMode, InvoiceDraftItem, InvoiceLineCategory, InvoicePaymentTerms, InvoiceRecord } from "@/lib/types";
import { parseUsAddress } from "@/lib/invoices/address";
import { estimateSalesTax, formatTaxPercent, salesTaxPercent } from "@/lib/invoices/sales-tax";
import { formatCurrency } from "@/lib/utils";

const categories: InvoiceLineCategory[] = ["service", "rental", "tonnage", "fee", "surcharge", "adjustment"];
const fuelEligibleServices = new Set(["Delivery", "Pick-Up", "Dump & Return", "Swap / Exchange", "Relocation", "Dry Run"]);
// `needsRate` is editor-only state: it drives the unpriced warning below and is
// deliberately absent from the payload `save()` builds, so it can never reach
// the ledger or Stripe.
type EditorItem = InvoiceDraftItem & { amount: string; key: string; needsRate?: boolean; fuelSurchargeEligible?: boolean };
type EligibleJob = { id: string; reference: string; serviceType: string; dumpsterSize: string; scheduledFor: string };
const blankItem = (): EditorItem => ({ description: "", amount: "", amountCents: 0, category: "service", jobId: null, key: crypto.randomUUID() });
const blankBilling = (contactName = ""): InvoiceBillingInput => ({ contactName, email: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "" });
function billingFromCustomer(customer: Customer): InvoiceBillingInput {
  // A name-only customer booked from the job form may still have a one-line
  // address; split it when it has a clean city, state and ZIP.
  const parsed = customer.billingAddressLine1 ? null : parseUsAddress(customer.address);
  return {
    contactName: customer.billingContactName || customer.name,
    email: customer.billingEmail || customer.email,
    phone: customer.phone,
    addressLine1: customer.billingAddressLine1 || parsed?.addressLine1 || customer.address,
    addressLine2: customer.billingAddressLine2,
    city: customer.billingCity || parsed?.city || "",
    state: customer.billingState || parsed?.state || "",
    postalCode: customer.billingPostalCode || parsed?.postalCode || "",
  };
}
const billingComplete = (billing: InvoiceBillingInput) =>
  Boolean(billing.contactName.trim() && billing.email.trim() && billing.addressLine1.trim() && billing.city.trim() && billing.state.trim() && billing.postalCode.trim());

export function InvoiceModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: InvoiceRecord }) {
  const { saveInvoice, settings, priceList, invoices, loading: financeLoading = false, priceListReady = true, refresh } = useExpandedOperations();
  const { customers, jobs, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  // The billing contact this invoice is sent to. Typed here for a one-off
  // customer, rather than requiring a full customer profile first.
  const [billing, setBilling] = React.useState<InvoiceBillingInput>(blankBilling);
  const [saveToProfile, setSaveToProfile] = React.useState(false);
  // Read once when the dialog opens; the live list changes under realtime
  // updates and must not reset what the office is typing.
  const customersRef = React.useRef(customers);
  customersRef.current = customers;
  const [billingMode, setBillingMode] = React.useState<InvoiceBillingMode>("per_job");
  const [jobIds, setJobIds] = React.useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = React.useState<InvoicePaymentTerms>("net_30");
  const [poNumber, setPoNumber] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<EditorItem[]>([blankItem()]);
  const [chargeSalesTax, setChargeSalesTax] = React.useState(false);
  const [catalogItemId, setCatalogItemId] = React.useState("");
  const [remoteJobs, setRemoteJobs] = React.useState<EligibleJob[] | null>(null);
  const editable = !invoice || invoice.status === "draft";
  const jobSelectionEditable = editable && !invoice?.revisedFromId;

  React.useEffect(() => {
    if (!open) return;
    setCustomerId(invoice?.customerId ?? "");
    setCustomerName("");
    setBilling(invoice ? {
      contactName: invoice.billingContactName,
      email: invoice.billingEmail,
      phone: customersRef.current.find((customer) => customer.id === invoice.customerId)?.phone ?? "",
      addressLine1: invoice.billingAddressLine1,
      addressLine2: invoice.billingAddressLine2,
      city: invoice.billingCity,
      state: invoice.billingState,
      postalCode: invoice.billingPostalCode,
    } : blankBilling());
    setSaveToProfile(false);
    setBillingMode(invoice?.billingMode ?? "per_job");
    setJobIds(invoice?.jobIds ?? []);
    setPaymentTerms(invoice?.paymentTerms ?? settings?.defaultPaymentTerms ?? "net_30");
    setPoNumber(invoice?.poNumber ?? "");
    setNotes(invoice?.notes ?? "");
    setChargeSalesTax(invoice?.chargeSalesTax ?? false);
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

  // Derived rather than stored, so an existing invoice shows its customer
  // without the setup effect having to read the customer list.
  const customerFieldValue = selectedCustomer?.name ?? customerName;
  // Sales tax is the office's choice per invoice, like the fuel fee: a GC's
  // quoted price already includes it. When on, every line is taxed at the
  // company's fixed rate; Stripe adds the same tax at send, and its figure is
  // the one stored.
  const companyTaxPercent = salesTaxPercent(settings?.taxPolicyStatus ?? "pending", settings?.salesTaxRate ?? 0);
  const taxPercent = chargeSalesTax ? companyTaxPercent : 0;
  const taxEstimate = estimateSalesTax(items.map((item) => Math.round(Number(item.amount) * 100) || 0), taxPercent);

  const matchCustomer = (name: string) =>
    customers.find((candidate) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase());

  const changeCustomerName = (name: string) => {
    setCustomerName(name);
    const match = matchCustomer(name);
    const nextId = match?.id ?? "";
    if (match) {
      if (nextId !== customerId) {
        setBilling(billingFromCustomer(match));
        // Offer to fill the profile's gaps; leave a complete profile alone so a
        // one-time billing address never quietly replaces it.
        setSaveToProfile(!billingComplete(billingFromCustomer(match)));
      }
    } else {
      // A new name: carry it into the billing name while the office types,
      // unless they have already written a different contact.
      setBilling((current) => customerId
        ? blankBilling(name)
        : { ...current, contactName: !current.contactName || current.contactName === customerName ? name : current.contactName });
    }
    if (nextId === customerId) return;
    setCustomerId(nextId);
    setJobIds([]);
    setItems([blankItem()]);
  };

  const updateBilling = (patch: Partial<InvoiceBillingInput>) => setBilling((current) => ({ ...current, ...patch }));
  const isNewCustomer = !customerId && Boolean(customerName.trim());
  const jobSiteAddress = jobIds
    .map((jobId) => jobs.find((job) => job.id === jobId)?.address ?? "")
    .map(parseUsAddress)
    .find(Boolean) ?? null;
  const jobSiteDiffers = Boolean(jobSiteAddress && (jobSiteAddress.addressLine1 !== billing.addressLine1 || jobSiteAddress.postalCode !== billing.postalCode));
  const unavailableJobs = new Set(invoices.filter((candidate) => candidate.id !== invoice?.id && candidate.status !== "void").flatMap((candidate) => candidate.jobIds));
  const localEligibleJobs = jobs.filter((job) => job.customerId === customerId && job.status === "complete" && !unavailableJobs.has(job.id));
  const eligibleJobs = remoteJobs ?? localEligibleJobs;

  const selectJob = (jobId: string, checked: boolean) => {
    if (financeLoading || !priceListReady) return;
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
    if (!customerId && !customerName.trim()) {
      toast("Pick a customer or type a new name.", { tone: "error" });
      return;
    }
    if (billing.email.trim() && !/^\S+@\S+\.\S+$/.test(billing.email.trim())) {
      toast("Enter a valid billing email, or leave it blank until you have one.", { tone: "error" });
      return;
    }
    const normalized = items.map((item) => ({
      description: item.description.trim(),
      amountCents: Math.round(Number(item.amount) * 100),
      jobId: item.jobId || null,
      category: item.category,
    }));
    const total = normalized.reduce((sum, item) => sum + item.amountCents, 0);
    if ((billingMode !== "one_off" && !jobIds.length) || total <= 0 || !Number.isSafeInteger(total) || normalized.some((item) => !item.description || !Number.isSafeInteger(item.amountCents) || item.amountCents === 0)) {
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
    const result = await saveInvoice({
      customerId,
      ...(customerId ? {} : { customerName: customerName.trim() }),
      billing,
      saveBillingToCustomer: Boolean(customerId) && saveToProfile,
      chargeSalesTax,
      billingMode, jobIds, paymentTerms, poNumber, notes, items: normalized,
    }, invoice?.id);
    setBusy(false);
    toast(result.ok
      ? isNewCustomer ? `Invoice draft saved. ${customerName.trim()} was added as a One-off customer.` : "Invoice draft saved"
      : result.error.message, { tone: result.ok ? "success" : "error" });
    if (result.ok) onClose();
  };

  return (
    <>
    <Modal open={open} onClose={onClose} title={invoice ? `${editable ? "Edit" : "View"} ${invoice.invoiceNumber}` : "New invoice draft"} widthClass="max-w-5xl" footer={<><Button variant="secondary" onClick={onClose}>{editable ? "Cancel" : "Close"}</Button>{editable && <Button disabled={busy || !canMutate} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</Button>}</>}>
      <div className="space-y-5">
        {!editable && <div className="rounded border border-brand-ice bg-brand-mist p-3 text-sm text-brand-steel">This invoice is finalized and read-only. Use a revision for corrections.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Invoice number" hint="Assigned automatically and never reused."><Input readOnly value={invoice?.invoiceNumber ?? "Assigned when saved"} /></FormField>
          <FormField label="Billing mode">
            <Select disabled={!jobSelectionEditable} value={billingMode} onChange={(event) => changeBillingMode(event.target.value as InvoiceBillingMode)}>
              <option value="per_job">Per job</option><option value="statement">Multi-job statement</option><option value="one_off">One-off (no job)</option>
            </Select>
          </FormField>
          <FormField label="Customer" required hideRequiredMark hint={editable && !invoice ? "Pick an existing customer, or type a new name. No profile needed for one-off jobs." : undefined}>
            <Input
              list="invoice-customers"
              disabled={!editable || Boolean(invoice)}
              placeholder="Customer name"
              value={customerFieldValue}
              onChange={(event) => changeCustomerName(event.target.value)}
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
        {(selectedCustomer || isNewCustomer || invoice) && (
          <fieldset className="rounded border border-brand-ice p-3">
            <legend className="px-1 font-heading font-semibold">Bill to</legend>
            <p className="mb-3 text-xs text-brand-steel">
              {isNewCustomer
                ? `${customerName.trim()} will be added as a One-off customer with these details. No profile to fill out.`
                : "Where this invoice is emailed and what address it carries. Change it here for this invoice only."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Billing name"><Input disabled={!editable} autoComplete="off" value={billing.contactName} onChange={(event) => updateBilling({ contactName: event.target.value })} /></FormField>
              <FormField label="Billing email" hint={billing.email.trim() ? undefined : "Needed before sending. The invoice and payment link go here."}><Input disabled={!editable} type="email" autoComplete="off" value={billing.email} onChange={(event) => updateBilling({ email: event.target.value })} /></FormField>
              <FormField label="Mobile phone" hint="Optional. Used for Text invoice."><Input disabled={!editable} type="tel" autoComplete="off" value={billing.phone} onChange={(event) => updateBilling({ phone: event.target.value })} /></FormField>
              <div className="hidden sm:block" />
              <FormField label="Street address"><Input disabled={!editable} autoComplete="off" value={billing.addressLine1} onChange={(event) => updateBilling({ addressLine1: event.target.value })} /></FormField>
              <FormField label="Apt / suite"><Input disabled={!editable} autoComplete="off" value={billing.addressLine2} onChange={(event) => updateBilling({ addressLine2: event.target.value })} /></FormField>
              <div className="grid grid-cols-[1fr_5rem_7rem] gap-3 sm:col-span-2">
                <FormField label="City"><Input disabled={!editable} autoComplete="off" value={billing.city} onChange={(event) => updateBilling({ city: event.target.value })} /></FormField>
                <FormField label="State"><Input disabled={!editable} autoComplete="off" maxLength={2} value={billing.state} onChange={(event) => updateBilling({ state: event.target.value.toUpperCase() })} /></FormField>
                <FormField label="ZIP"><Input disabled={!editable} autoComplete="off" inputMode="numeric" maxLength={10} value={billing.postalCode} onChange={(event) => updateBilling({ postalCode: event.target.value })} /></FormField>
              </div>
            </div>
            {editable && (jobSiteDiffers || (customerId && !invoice)) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {jobSiteAddress && jobSiteDiffers ? (
                  <button type="button" className="text-sm font-semibold text-brand-blue underline-offset-2 hover:underline" onClick={() => jobSiteAddress && updateBilling(jobSiteAddress)}>
                    Use job site address ({jobSiteAddress.addressLine1}, {jobSiteAddress.city})
                  </button>
                ) : <span />}
                {customerId && !invoice && selectedCustomer && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saveToProfile} onChange={(event) => setSaveToProfile(event.target.checked)} />
                    Also save these details to {selectedCustomer.name}&apos;s profile
                  </label>
                )}
              </div>
            )}
          </fieldset>
        )}
        {/* Austin asked for no asterisks anywhere in invoicing. Both fields stay
            required for validation and assistive technology. */}
        {billingMode === "one_off" ? (
          <div className="rounded border border-brand-ice bg-brand-mist p-3 text-sm text-brand-steel">
            A one-off invoice bills its line items directly, with no completed job behind it. Use it for a charge that never was a job, or for a customer with no job history yet.
          </div>
        ) : (
        <FormField label={billingMode === "statement" ? "Completed jobs" : "Completed job"} required hideRequiredMark>
          <div className="max-h-40 space-y-2 overflow-auto rounded border border-brand-ice p-3">
            {eligibleJobs.map((job) => {
              const rate = priceList.find((item) => item.serviceType === job.serviceType && item.dumpsterSize === job.dumpsterSize);
              return <label key={job.id} className="flex min-h-8 items-center gap-2"><input disabled={!jobSelectionEditable || financeLoading || !priceListReady} type={billingMode === "per_job" ? "radio" : "checkbox"} name="invoice-job" checked={jobIds.includes(job.id)} onChange={(event) => selectJob(job.id, event.target.checked)} /><span>{job.reference} · {job.serviceType} · {job.dumpsterSize} · {financeLoading ? "Loading rate…" : !priceListReady ? "Rates unavailable" : rate ? `${formatCurrency(rate.priceCents)} preset` : "No rate on file"}</span></label>;
            })}
            {!eligibleJobs.length && <span className="text-sm text-brand-steel">No uninvoiced completed jobs for this customer. Switch to a one-off invoice to bill without one.</span>}
          </div>
        </FormField>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-heading font-semibold">Line items</h3>
            <span className="text-xs text-brand-steel">{items.length} {items.length === 1 ? "line" : "lines"}</span>
          </div>
          {financeLoading ? (
            <p className="mb-3 text-sm text-brand-steel" role="status">Loading preset prices before you select a job…</p>
          ) : !priceListReady ? (
            <p className="mb-3 text-sm text-red-700" role="alert">Settings rates could not be loaded. <button type="button" className="underline" onClick={() => void refresh()}>Retry</button> before selecting a job.</p>
          ) : priceList.length === 0 ? (
            <p className="mb-3 text-sm text-status-pending">No preset prices are configured. Enter line amounts manually or ask management to add rates in Settings.</p>
          ) : (
            <p className="mb-3 text-xs text-brand-steel">Job lines use the Settings rate for their service and dumpster size. You can change the suggested amount.</p>
          )}
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
              <Select aria-label="Add priced catalog line" disabled={financeLoading || !priceListReady} value={catalogItemId} onChange={(event) => addCatalogLine(event.target.value)}>
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-brand-steel">Sales tax</span>
              <span className="flex flex-wrap items-center justify-end gap-2 font-medium text-brand-charcoal">
                {!settings
                  ? "Loading tax rate…"
                  : chargeSalesTax
                    ? `${formatTaxPercent(taxPercent)} · ${formatCurrency(taxEstimate.taxCents)} · Total ${formatCurrency(taxEstimate.totalCents)}`
                    : `Not charged · Total ${formatCurrency(taxEstimate.totalCents)}`}
                {settings && companyTaxPercent > 0 && (
                  <Button type="button" variant="secondary" aria-pressed={chargeSalesTax} onClick={() => setChargeSalesTax((on) => !on)}>
                    {chargeSalesTax ? "Remove sales tax" : `Add ${formatTaxPercent(companyTaxPercent)} sales tax`}
                  </Button>
                )}
              </span>
            </div>
          )}
        </div>
        <FormField label="Notes"><Textarea disabled={!editable} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
        {!editable && <div className="grid gap-2 text-sm sm:grid-cols-2"><div>Subtotal: <strong>{formatCurrency(invoice?.subtotalCents ?? 0)}</strong></div><div>Tax: <strong>{formatCurrency(invoice?.taxCents ?? 0)}</strong></div><div>Total: <strong>{formatCurrency(invoice?.amountCents ?? 0)}</strong></div><div>Canonical status: <strong>{invoice?.status}</strong></div><div>Display status: <strong>{invoice?.displayStatus.replaceAll("_", " ")}</strong></div><div>Paid: <strong>{formatCurrency(invoice?.amountPaidCents ?? 0)}</strong></div><div>Remaining: <strong>{formatCurrency(invoice?.amountRemainingCents ?? 0)}</strong></div></div>}
      </div>
    </Modal>
    </>
  );
}
