"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { InvoiceRecord, InvoiceStatus } from "@/lib/types";
export function InvoiceModal({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice?: InvoiceRecord;
}) {
  const { saveInvoice, settings } = useExpandedOperations();
  const { customers, jobs, canMutate } = useOperations();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    invoiceNumber: "",
    customerId: "",
    jobId: "",
    amount: "",
    status: "draft" as InvoiceStatus,
    dueDate: "",
    notes: "",
  });
  React.useEffect(() => {
    if (open)
      setForm({
        invoiceNumber:
          invoice?.invoiceNumber ?? `${settings?.invoicePrefix ?? "INV"}-`,
        customerId: invoice?.customerId ?? "",
        jobId: invoice?.jobId ?? "",
        amount: invoice ? (invoice.amountCents / 100).toFixed(2) : "",
        status: invoice?.status ?? "draft",
        dueDate: invoice?.dueDate ?? "",
        notes: invoice?.notes ?? "",
      });
  }, [open, invoice, settings]);
  const save = async () => {
    const amount = Math.round(Number(form.amount) * 100);
    if (
      !form.invoiceNumber.trim() ||
      !form.customerId ||
      !form.dueDate ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    ) {
      toast(
        "Invoice number, customer, valid amount, and due date are required.",
        { tone: "error" },
      );
      return;
    }
    setBusy(true);
    const r = await saveInvoice(
      { ...form, jobId: form.jobId || null, amountCents: amount },
      invoice?.id,
    );
    setBusy(false);
    toast(r.ok ? "Invoice saved" : r.error.message, {
      tone: r.ok ? "success" : "error",
    });
    if (r.ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={invoice ? `Edit ${invoice.invoiceNumber}` : "New Invoice"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !canMutate} onClick={() => void save()}>
            {busy ? "Saving…" : "Save Invoice"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Invoice Number" required>
          <Input
            value={form.invoiceNumber}
            onChange={(e) =>
              setForm({ ...form, invoiceNumber: e.target.value })
            }
          />
        </FormField>
        <FormField label="Amount" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </FormField>
        <FormField label="Customer" required>
          <Select
            value={form.customerId}
            onChange={(e) =>
              setForm({ ...form, customerId: e.target.value, jobId: "" })
            }
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Related Job">
          <Select
            value={form.jobId}
            onChange={(e) => setForm({ ...form, jobId: e.target.value })}
          >
            <option value="">No job</option>
            {jobs
              .filter((j) => j.customerId === form.customerId)
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.reference}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as InvoiceStatus })
            }
          >
            {["draft", "sent", "paid", "overdue", "closed", "void"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due Date" required>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
