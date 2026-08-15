"use client";

import * as React from "react";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import {
  formatHoursDuration,
  formatPacificTime,
  summarizeTime,
} from "@/lib/time-clock";

/**
 * The signed-in user's own clock, shared by both portals.
 *
 * Drivers punch in from the mobile portal and dispatch and office staff from
 * the desk portal. The two look nothing alike, but the state machine behind
 * them — which action is legal next, how worked time accrues, the clock-out
 * confirmation — must stay identical, so it lives here rather than being
 * written twice and drifting.
 */
export function useTimeClock() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { currentUser, timeEntries, recordTimeEntry, canMutate } =
    useOperations();

  // Drives the running duration. One second is the coarsest tick that still
  // looks live on the seconds display the driver portal shows.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const summary = React.useMemo(
    () => summarizeTime(currentUser?.id ?? "", timeEntries, now),
    [currentUser?.id, timeEntries, now],
  );

  const elapsed = summary.workedSeconds;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const record = React.useCallback(
    async (
      type: "clock_in" | "break_start" | "break_end" | "clock_out",
      success: string,
    ) => {
      const result = await recordTimeEntry(type);
      toast(result.ok ? success : result.error.message, {
        tone: result.ok ? "success" : "error",
      });
      return result.ok;
    },
    [recordTimeEntry, toast],
  );

  const todayDuration = formatHoursDuration(elapsed / 3600);

  const clockOut = React.useCallback(async () => {
    const at = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    // Confirmed because it ends the shift: an accidental clock-out has to be
    // unwound through a time-correction request and an approval.
    const ok = await confirm({
      title: "Clock out?",
      message: `You'll be clocked out at ${at} with ${todayDuration} worked today.`,
      confirmLabel: "Clock Out",
      tone: "danger",
    });
    if (!ok) return false;
    return record("clock_out", "Clocked out");
  }, [confirm, record, todayDuration]);

  return {
    summary,
    phase: summary.phase,
    canMutate,
    /** Wall-clock time worked today, formatted `h:mm:ss`. */
    hhmmss: `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    todayDuration,
    startedAt: summary.clockIn ? formatPacificTime(summary.clockIn) : null,
    statusText:
      summary.phase === "in"
        ? "Currently Clocked In"
        : summary.phase === "break"
          ? "On Break"
          : "Clocked Out",
    clockIn: () => record("clock_in", "Clocked in"),
    startBreak: () => record("break_start", "Break started"),
    endBreak: () => record("break_end", "Back on the clock"),
    clockOut,
  };
}
