"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { Customer } from "@/lib/types";
export function CustomerModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
}) {
  const { saveCustomer, canMutate } = useOperations();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    billingContactName: "",
    billingEmail: "",
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingCity: "",
    billingState: "",
    billingPostalCode: "",
    billingCountry: "US" as const,
    group: "Commercial" as NonNullable<Customer["group"]>,
  });
  React.useEffect(() => {
    if (open)
      setForm({
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        address: customer?.address ?? "",
        billingContactName: customer?.billingContactName ?? customer?.name ?? "",
        billingEmail: customer?.billingEmail ?? customer?.email ?? "",
        billingAddressLine1: customer?.billingAddressLine1 ?? customer?.address ?? "",
        billingAddressLine2: customer?.billingAddressLine2 ?? "",
        billingCity: customer?.billingCity ?? "",
        billingState: customer?.billingState ?? "",
        billingPostalCode: customer?.billingPostalCode ?? "",
        billingCountry: "US",
        group: customer?.group ?? "Commercial",
      });
  }, [open, customer]);
  const save = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      toast("Customer name and address are required.", { tone: "error" });
      return;
    }
    setSaving(true);
    const r = await saveCustomer(form, customer?.id);
    setSaving(false);
    toast(r.ok ? "Customer saved" : r.error.message, {
      tone: r.ok ? "success" : "error",
    });
    if (r.ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Edit Customer" : "Add Customer"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !canMutate} onClick={() => void save()}>
            {saving ? "Saving…" : "Save Customer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label="Address" required>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        <FormField label="Phone">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
        <FormField label="Group">
          <Select
            value={form.group}
            onChange={(e) =>
              setForm({ ...form, group: e.target.value as typeof form.group })
            }
          >
            <option>Big GC</option>
            <option>Commercial</option>
            <option>Residential</option>
          </Select>
        </FormField>
        <div className="border-t border-brand-ice pt-4">
          <h3 className="font-heading font-semibold text-brand-charcoal">Billing contact</h3>
          <p className="mt-1 text-sm text-brand-steel">These reviewed details are frozen onto each invoice.</p>
        </div>
        <FormField label="Billing contact name">
          <Input value={form.billingContactName} onChange={(e) => setForm({ ...form, billingContactName: e.target.value })} />
        </FormField>
        <FormField label="Billing email">
          <Input type="email" value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
        </FormField>
        <FormField label="Billing address line 1">
          <Input value={form.billingAddressLine1} onChange={(e) => setForm({ ...form, billingAddressLine1: e.target.value })} />
        </FormField>
        <FormField label="Billing address line 2">
          <Input value={form.billingAddressLine2} onChange={(e) => setForm({ ...form, billingAddressLine2: e.target.value })} />
        </FormField>
        <FormField label="Billing city">
          <Input value={form.billingCity} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="State">
            <Input maxLength={2} value={form.billingState} onChange={(e) => setForm({ ...form, billingState: e.target.value.toUpperCase() })} />
          </FormField>
          <FormField label="ZIP code">
            <Input value={form.billingPostalCode} onChange={(e) => setForm({ ...form, billingPostalCode: e.target.value })} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
