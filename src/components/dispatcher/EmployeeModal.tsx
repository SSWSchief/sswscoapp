"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { AccessRole, UserRole } from "@/lib/types";

export function EmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { canMutate, refresh } = useOperations();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ employeeId: "", fullName: "", email: "", phone: "", role: "driver" as UserRole, accessRole: "driver" as AccessRole });
  React.useEffect(() => { if (open) setForm({ employeeId: "", fullName: "", email: "", phone: "", role: "driver", accessRole: "driver" }); }, [open]);
  const save = async () => {
    if (!form.employeeId.trim() || !form.fullName.trim() || !form.email.trim()) { toast("Employee ID, name, and email are required.", { tone: "error" }); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/employees", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Employee invitation could not be created.");
      await refresh();
      toast("Employee created and invitation initiated", { tone: "success" });
      onClose();
    } catch (error) { toast(error instanceof Error ? error.message : "Employee invitation failed.", { tone: "error" }); }
    finally { setSaving(false); }
  };
  return <Modal open={open} onClose={onClose} title="Add Employee" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!canMutate || saving} onClick={() => void save()}>{saving ? "Creating…" : "Create & Invite"}</Button></>}>
    <div className="space-y-4">
      <FormField label="Employee ID" required><Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} /></FormField>
      <FormField label="Full Name" required><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></FormField>
      <FormField label="Email" required><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></FormField>
      <FormField label="Phone"><Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></FormField>
      <FormField label="Operational Role"><Select value={form.role} onChange={e => {const role=e.target.value as UserRole;setForm({ ...form, role, accessRole:role==="driver"?"driver":role==="management"?"admin":"dispatcher" });}}><option value="driver">Driver</option><option value="dispatcher">Dispatcher</option><option value="office">Office</option><option value="management">Management</option></Select></FormField>
      <FormField label="Access Role"><Select value={form.accessRole} onChange={e => setForm({ ...form, accessRole: e.target.value as AccessRole })}><option value="driver">Driver</option><option value="dispatcher">Dispatcher</option><option value="admin">Administrator</option></Select></FormField>
      <p className="text-xs text-brand-steel">Submitting invokes the secure server endpoint and sends the configured Supabase invitation email.</p>
    </div>
  </Modal>;
}
