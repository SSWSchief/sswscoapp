"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { pacificDate } from "@/lib/time-clock";
import type { TimeEntryType } from "@/lib/types";

export function TimeRequestModal({ open, kind, onClose }: { open: boolean; kind: "edit_time" | "pto"; onClose: () => void }) {
  const { timeEntries, currentUser, createTimeRequest, canMutate } = useOperations();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ requestedFor: pacificDate(new Date()), hours: "8", reason: "", targetEntryId: "", requestedEntryType: "clock_in" as TimeEntryType, requestedAt: "" });
  const entries = React.useMemo(() => timeEntries.filter(entry => entry.userId === currentUser?.id), [currentUser?.id, timeEntries]);
  React.useEffect(() => { if (open) setForm({ requestedFor: pacificDate(new Date()), hours: "8", reason: "", targetEntryId: entries[0]?.id ?? "", requestedEntryType: entries[0]?.type ?? "clock_in", requestedAt: "" }); }, [entries, open]);
  const submit = async () => {
    if (!form.reason.trim() || (kind === "edit_time" && (!form.targetEntryId || !form.requestedAt))) { toast("Complete all required request details.", { tone: "error" }); return; }
    setSaving(true);
    const result = await createTimeRequest({ kind, requestedFor: form.requestedFor, hours: kind === "pto" ? Number(form.hours) : 0, reason: form.reason, targetEntryId: kind === "edit_time" ? form.targetEntryId : null, requestedEntryType: kind === "edit_time" ? form.requestedEntryType : null, requestedAt: kind === "edit_time" ? new Date(form.requestedAt).toISOString() : null });
    setSaving(false);
    toast(result.ok ? "Request submitted for dispatcher review" : result.error.message, { tone: result.ok ? "success" : "error" });
    if (result.ok) onClose();
  };
  return <Modal open={open} onClose={onClose} title={kind === "pto" ? "Request PTO" : "Request Time Correction"} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!canMutate || saving} onClick={() => void submit()}>{saving ? "Submitting…" : "Submit Request"}</Button></>}>
    <div className="space-y-4">
      <FormField label="Date" required><Input type="date" value={form.requestedFor} onChange={e => setForm({ ...form, requestedFor: e.target.value })} /></FormField>
      {kind === "pto" ? <FormField label="Hours" required><Input type="number" min="0.25" step="0.25" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></FormField> : <>
        <FormField label="Event to correct" required><Select value={form.targetEntryId} onChange={e => { const entry = entries.find(item => item.id === e.target.value); setForm({ ...form, targetEntryId: e.target.value, requestedEntryType: entry?.type ?? form.requestedEntryType }); }}><option value="">Select an event</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.type.replace("_", " ")} · {new Date(entry.at).toLocaleString()}</option>)}</Select></FormField>
        <FormField label="Corrected event type" required><Select value={form.requestedEntryType} onChange={e => setForm({ ...form, requestedEntryType: e.target.value as TimeEntryType })}>{["clock_in", "break_start", "break_end", "clock_out"].map(type => <option key={type} value={type}>{type.replace("_", " ")}</option>)}</Select></FormField>
        <FormField label="Corrected timestamp" required><Input type="datetime-local" value={form.requestedAt} onChange={e => setForm({ ...form, requestedAt: e.target.value })} /></FormField>
      </>}
      <FormField label="Reason" required><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></FormField>
      <p className="text-xs text-brand-steel">Approved corrections create an immutable audit record; the original event is retained.</p>
    </div>
  </Modal>;
}
