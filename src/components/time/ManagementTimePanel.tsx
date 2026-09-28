"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { mapPaidTimeAdjustment, mapTimeCorrection, mapTimeEntry } from "@/lib/supabase/mappers";
import type { CorrectionRow, PaidTimeAdjustmentRow, TimeEntryRow } from "@/lib/supabase/database.types";
import type { PaidTimeAdjustment, TimeEntry, TimeEntryType } from "@/lib/types";
import { applyTimeCorrections, clocksIn, formatPacificTime, pacificClockValue, pacificDate, pacificDayEnd, pacificDayStart, pacificInstant } from "@/lib/time-clock";

const punchTypes: { value: TimeEntryType; label: string }[] = [
  { value: "clock_in", label: "Clock in" },
  { value: "break_start", label: "Break start" },
  { value: "break_end", label: "Break end" },
  { value: "clock_out", label: "Clock out" },
];

export function ManagementTimePanel({ onSaved }: { onSaved: () => void }) {
  const { users, currentUser, canMutate } = useOperations();
  const { toast } = useToast();
  const staff = users.filter((person) => clocksIn(person) && person.status === "active" && person.id !== currentUser?.id);
  const [userId, setUserId] = React.useState("");
  const [date, setDate] = React.useState(() => pacificDate(new Date()));
  const [mode, setMode] = React.useState<"paid" | "punch">("paid");
  const [entries, setEntries] = React.useState<TimeEntry[]>([]);
  const [adjustments, setAdjustments] = React.useState<PaidTimeAdjustment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [targetEntryId, setTargetEntryId] = React.useState("");
  const [punchType, setPunchType] = React.useState<TimeEntryType>("clock_in");
  const [punchTime, setPunchTime] = React.useState("");
  const [hours, setHours] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [revisingId, setRevisingId] = React.useState<string | null>(null);
  const [reversingId, setReversingId] = React.useState<string | null>(null);
  const [reverseReason, setReverseReason] = React.useState("");
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!userId && staff[0]) setUserId(staff[0].id);
  }, [staff, userId]);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const db = createClient();
      const [punches, corrections, paid] = await Promise.all([
        db.from("time_entries").select("*").eq("user_id", userId)
          .gte("occurred_at", pacificDayStart(date)).lt("occurred_at", pacificDayEnd(date))
          .order("occurred_at").limit(200),
        db.from("time_entry_corrections").select("*").eq("user_id", userId)
          .is("superseded_at", null).limit(1000),
        db.from("paid_time_adjustments").select("*").eq("user_id", userId)
          .eq("work_date", date).order("created_at", { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      if (punches.error || corrections.error || paid.error) {
        toast("Employee time could not be loaded.", { tone: "error" });
        setEntries([]);
        setAdjustments([]);
      } else {
        setEntries(applyTimeCorrections(
          ((punches.data ?? []) as TimeEntryRow[]).map(mapTimeEntry),
          ((corrections.data ?? []) as CorrectionRow[]).map(mapTimeCorrection),
        ).filter((entry) => pacificDate(entry.at) === date));
        setAdjustments(((paid.data ?? []) as PaidTimeAdjustmentRow[]).map(mapPaidTimeAdjustment));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, date, reload, toast]);

  const choosePunch = (id: string) => {
    setTargetEntryId(id);
    const entry = entries.find((candidate) => candidate.id === id);
    if (entry) {
      setPunchType(entry.type);
      setPunchTime(pacificClockValue(entry.at));
    } else {
      setPunchTime("");
    }
  };

  const save = async () => {
    if (!canMutate || !userId || reason.trim().length < 3) {
      toast("Choose an employee and enter a reason of at least three characters.", { tone: "error" });
      return;
    }
    setBusy(true);
    const db = createClient();
    let error: { message: string } | null = null;
    if (mode === "paid") {
      const minutes = Math.round(Number(hours) * 60);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
        toast("Enter more than zero and no more than 24 paid hours.", { tone: "error" });
        setBusy(false);
        return;
      }
      const result = await db.rpc("save_paid_time_adjustment", {
        target_user_id: userId,
        target_date: date,
        minutes,
        adjustment_reason: reason.trim(),
        previous_id: revisingId,
      });
      error = result.error;
    } else {
      const instant = pacificInstant(date, punchTime);
      if (!instant) {
        toast("Enter a valid Pacific time for the punch.", { tone: "error" });
        setBusy(false);
        return;
      }
      const result = await db.rpc("manage_time_correction", {
        target_user_id: userId,
        punch_type: punchType,
        punch_at: instant,
        correction_reason: reason.trim(),
        original_entry_id: targetEntryId && !targetEntryId.startsWith("correction:") ? targetEntryId : null,
        replaces_correction_id: targetEntryId.startsWith("correction:") ? targetEntryId.slice("correction:".length) : null,
      });
      error = result.error;
    }
    setBusy(false);
    if (error) {
      toast(error.message, { tone: "error" });
      return;
    }
    setHours("");
    setReason("");
    setRevisingId(null);
    setTargetEntryId("");
    setPunchTime("");
    setReload((current) => current + 1);
    onSaved();
    toast(mode === "paid" ? "Paid hours recorded." : "Punch correction recorded.", { tone: "success" });
  };

  const reverse = async () => {
    if (!reversingId || reverseReason.trim().length < 3) {
      toast("Enter a reversal reason of at least three characters.", { tone: "error" });
      return;
    }
    setBusy(true);
    const result = await createClient().rpc("void_paid_time_adjustment", {
      target_id: reversingId,
      reversal_reason: reverseReason.trim(),
    });
    setBusy(false);
    if (result.error) {
      toast(result.error.message, { tone: "error" });
      return;
    }
    setReversingId(null);
    setReverseReason("");
    setReload((current) => current + 1);
    onSaved();
    toast("Paid hours reversed.", { tone: "success" });
  };

  if (currentUser?.accessRole !== "admin") return null;
  return (
    <Card className="mt-5">
      <CardHeader title="Manage Employee Time" />
      <div className="space-y-4 p-4">
        <p className="text-sm text-brand-steel">Paid hours are separate from worked clock time. Punch changes are recorded with your name and reason.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Employee<Select value={userId} onChange={(event) => { setUserId(event.target.value); setRevisingId(null); }}><option value="">Select employee</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</Select></label>
          <label className="text-sm">Work date<Input type="date" value={date} onChange={(event) => { setDate(event.target.value); setRevisingId(null); }} /></label>
          <label className="text-sm">Record<Select value={mode} onChange={(event) => { setMode(event.target.value as "paid" | "punch"); setReason(""); }}><option value="paid">Paid hours adjustment</option><option value="punch">Punch correction</option></Select></label>
        </div>
        {mode === "paid" ? (
          <label className="block text-sm">Paid hours<Input type="number" min="0.01" max="24" step="0.01" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="4.00" /></label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Change or add<Select value={targetEntryId} onChange={(event) => choosePunch(event.target.value)}><option value="">Add missing punch</option>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.type.replaceAll("_", " ")} · {formatPacificTime(entry.at)}</option>)}</Select></label>
            <label className="text-sm">Punch type<Select value={punchType} onChange={(event) => setPunchType(event.target.value as TimeEntryType)}>{punchTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label>
            <label className="text-sm">Pacific time<Input type="time" value={punchTime} onChange={(event) => setPunchTime(event.target.value)} /></label>
          </div>
        )}
        <label className="block text-sm">Reason<Textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={mode === "paid" ? "Three-hour minimum and one-hour meeting" : "Corrected missed clock-out"} /></label>
        <Button disabled={busy || loading || !canMutate || !userId} onClick={() => void save()}>{busy ? "Saving…" : revisingId ? "Save revised hours" : mode === "paid" ? "Add paid hours" : "Save punch correction"}</Button>
        {mode === "paid" && adjustments.length > 0 && (
          <div className="border-t border-brand-ice pt-3">
            <h3 className="font-semibold">Paid adjustments for {date}</h3>
            <ul className="mt-2 space-y-2">
              {adjustments.map((adjustment) => (
                <li key={adjustment.id} className="rounded border border-brand-ice p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span>{(adjustment.paidMinutes / 60).toFixed(2)}h · {adjustment.reason}{adjustment.voidedAt ? " · Reversed" : ""}</span>{!adjustment.voidedAt && <span className="flex gap-3"><button type="button" className="text-brand-blue" onClick={() => { setRevisingId(adjustment.id); setHours((adjustment.paidMinutes / 60).toFixed(2)); setReason(adjustment.reason); }}>Revise</button><button type="button" className="text-red-700" onClick={() => setReversingId(adjustment.id)}>Reverse</button></span>}</div>
                  {reversingId === adjustment.id && <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Reversal reason" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} placeholder="Reason for reversal" /><Button disabled={busy || !canMutate} onClick={() => void reverse()}>Confirm reversal</Button></div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
