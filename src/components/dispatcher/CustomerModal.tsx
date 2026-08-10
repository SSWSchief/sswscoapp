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
    group: "Commercial" as NonNullable<Customer["group"]>,
  });
  React.useEffect(() => {
    if (open)
      setForm({
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        address: customer?.address ?? "",
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
      </div>
    </Modal>
  );
}
