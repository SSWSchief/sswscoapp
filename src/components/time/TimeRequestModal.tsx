"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { formatPacificTime, pacificDate } from "@/lib/time-clock";
import type { TimeEntry, TimeEntryType } from "@/lib/types";

/** The clock time of an entry as HH:MM, for a time input. */
const clockValue = (entry: TimeEntry | undefined) => {
  if (!entry) return "";
  const at = new Date(entry.at);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

export function TimeRequestModal({
  open,
  kind,
  onClose,
}: {
  open: boolean;
  kind: "edit_time" | "pto";
  onClose: () => void;
}) {
  const { myRecentTimeEntries, createTimeRequest, canMutate } = useOperations();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    requestedFor: pacificDate(new Date()),
    hours: "8",
    reason: "",
    startedAt: "",
    finishedAt: "",
  });

  /**
   * What the clock currently holds for the chosen day: the first clock-in and
   * the last clock-out. Either can be absent — a forgotten punch is the most
   * common reason to be here at all.
   */
  const onDay = React.useMemo(() => {
    const punches = myRecentTimeEntries
      .filter((entry) => pacificDate(entry.at) === form.requestedFor)
      .sort((left, right) => left.at.localeCompare(right.at));
    return {
      clockIn: punches.find((entry) => entry.type === "clock_in"),
      clockOut: [...punches].reverse().find((entry) => entry.type === "clock_out"),
    };
  }, [myRecentTimeEntries, form.requestedFor]);

  React.useEffect(() => {
    if (open)
      setForm({
        requestedFor: pacificDate(new Date()),
        hours: "8",
        reason: "",
        startedAt: "",
        finishedAt: "",
      });
  }, [open]);

  // Prefill with what is recorded so the driver edits a real shift rather than
  // typing one from memory, and so an unchanged field can be left alone.
  React.useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      startedAt: clockValue(onDay.clockIn),
      finishedAt: clockValue(onDay.clockOut),
    }));
  }, [open, onDay.clockIn, onDay.clockOut]);

  const submitPto = async () => {
    const result = await createTimeRequest({
      kind: "pto",
      requestedFor: form.requestedFor,
      hours: Number(form.hours),
      reason: form.reason,
      targetEntryId: null,
      requestedEntryType: null,
      requestedAt: null,
    });
    return result.ok ? null : result.error.message;
  };

  /**
   * File one request per punch the driver actually changed.
   *
   * A punch that exists is corrected against its own id; one that was never
   * made is filed with no target, which the reviewer's approval turns into an
   * added punch. Fields left as they were are skipped, so a driver fixing only
   * a clock-out does not resubmit a clock-in that was always right.
   */
  const submitShift = async () => {
    const wanted: {
      type: TimeEntryType;
      value: string;
      existing: TimeEntry | undefined;
    }[] = [
      { type: "clock_in", value: form.startedAt, existing: onDay.clockIn },
      { type: "clock_out", value: form.finishedAt, existing: onDay.clockOut },
    ];
    const changes = wanted.filter(
      ({ value, existing }) => value && value !== clockValue(existing),
    );
    if (!changes.length) return "Change a start or finish time first.";
    for (const change of changes) {
      const at = new Date(`${form.requestedFor}T${change.value}`);
      if (Number.isNaN(at.getTime())) return "That time could not be read.";
      const result = await createTimeRequest({
        kind: "edit_time",
        requestedFor: form.requestedFor,
        hours: 0,
        reason: form.reason,
        targetEntryId: change.existing?.id ?? null,
        requestedEntryType: change.type,
        requestedAt: at.toISOString(),
      });
      if (!result.ok) return result.error.message;
    }
    return null;
  };

  const submit = async () => {
    if (!form.reason.trim()) {
      toast("Say why the change is needed.", { tone: "error" });
      return;
    }
    setSaving(true);
    const error = kind === "pto" ? await submitPto() : await submitShift();
    setSaving(false);
    toast(
      error ??
        (kind === "pto"
          ? "PTO request submitted for management review"
          : "Time correction submitted for review"),
      { tone: error ? "error" : "success" },
    );
    if (!error) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "pto" ? "Request PTO" : "Fix My Hours"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canMutate || saving} onClick={() => void submit()}>
            {saving ? "Submitting…" : "Submit Request"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={kind === "pto" ? "Date" : "Which day?"} required>
          <Input
            type="date"
            value={form.requestedFor}
            onChange={(e) => setForm({ ...form, requestedFor: e.target.value })}
          />
        </FormField>

        {kind === "pto" ? (
          <FormField label="Hours" required>
            <Input
              type="number"
              min="0.25"
              step="0.25"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </FormField>
        ) : (
          <>
            <div className="rounded border border-brand-ice p-3 text-sm dark:border-white/10">
              <div className="font-semibold text-brand-charcoal dark:text-white">
                Currently recorded
              </div>
              <div className="mt-1 text-brand-steel dark:text-gray-400">
                Started{" "}
                {onDay.clockIn ? formatPacificTime(onDay.clockIn.at) : "—"} ·
                Finished{" "}
                {onDay.clockOut ? formatPacificTime(onDay.clockOut.at) : "—"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Started at">
                <Input
                  type="time"
                  value={form.startedAt}
                  onChange={(e) =>
                    setForm({ ...form, startedAt: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Finished at">
                <Input
                  type="time"
                  value={form.finishedAt}
                  onChange={(e) =>
                    setForm({ ...form, finishedAt: e.target.value })
                  }
                />
              </FormField>
            </div>
            <p className="-mt-2 text-xs text-brand-steel dark:text-gray-400">
              A dash above means that punch was never recorded. Fill it in and
              dispatch can add it.
            </p>
          </>
        )}

        <FormField label="Reason" required>
          <Textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </FormField>
      </div>
    </Modal>
  );
}
