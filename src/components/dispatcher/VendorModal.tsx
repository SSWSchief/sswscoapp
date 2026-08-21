"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { Vendor } from "@/lib/types";
export function VendorModal({
  open,
  onClose,
  vendor,
}: {
  open: boolean;
  onClose: () => void;
  vendor?: Vendor;
}) {
  const { saveVendor, canMutate } = useOperations();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    category: "",
    phone: "",
    email: "",
    notes: "",
  });
  React.useEffect(() => {
    if (open)
      setForm({
        name: vendor?.name ?? "",
        category: vendor?.category ?? "",
        phone: vendor?.phone ?? "",
        email: vendor?.email ?? "",
        notes: vendor?.notes ?? "",
      });
  }, [open, vendor]);
  const save = async () => {
    if (!form.name.trim()) {
      toast("Vendor name is required.", { tone: "error" });
      return;
    }
    setSaving(true);
    const r = await saveVendor(form, vendor?.id);
    setSaving(false);
    toast(r.ok ? "Vendor saved" : r.error.message, {
      tone: r.ok ? "success" : "error",
    });
    if (r.ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vendor ? "Edit Vendor" : "Add Vendor"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !canMutate} onClick={() => void save()}>
            {saving ? "Saving…" : "Save Vendor"}
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
        <FormField label="Category">
          <Input
            placeholder="Towing, Locksmith, Parts Supplier…"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
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
        <FormField label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormField>
      </div>
    </Modal>
  );
}
