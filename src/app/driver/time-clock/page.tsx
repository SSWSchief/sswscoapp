"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { cn } from "@/lib/utils";
import { useOperations } from "@/components/system/OperationsProvider";
import {
  formatHoursDuration,
  formatPacificTime,
  summarizeTime,
} from "@/lib/time-clock";
import { TimeRequestModal } from "@/components/driver/TimeRequestModal";

const dot = {
  green: "bg-status-complete",
  amber: "bg-status-pending",
  gray: "bg-brand-silver dark:bg-gray-600",
};

function nowLabel() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DriverTimeClockPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const {
    currentUser: driver,
    timeRequests,
    timeEntries,
    recordTimeEntry,
    canMutate,
  } = useOperations();
  const requests = timeRequests.filter(
    (request) => request.userId === driver?.id,
  );

  const [now, setNow] = React.useState(() => new Date());
  const [requestKind, setRequestKind] = React.useState<
    "edit_time" | "pto" | null
  >(null);
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const summary = React.useMemo(
    () => summarizeTime(driver?.id ?? "", timeEntries, now),
    [driver?.id, timeEntries, now],
  );
  const phase = summary.phase;
  const entries = summary.entries.map((entry) => ({
    label: {
      clock_in: "Clock In",
      break_start: "Start Break",
      break_end: "End Break",
      clock_out: "Clock Out",
    }[entry.type],
    time: formatPacificTime(entry.at),
    tone: (entry.type === "clock_in"
      ? "green"
      : entry.type === "clock_out"
        ? "gray"
        : "amber") as "green" | "amber" | "gray",
  }));
  const elapsed = summary.workedSeconds;

  const hhmmss = React.useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsed]);

  const todayDuration = formatHoursDuration(elapsed / 3600);

  const record = async (
    type: "clock_in" | "break_start" | "break_end" | "clock_out",
    success: string,
  ) => {
    const result = await recordTimeEntry(type);
    toast(result.ok ? success : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };
  const startBreak = () => void record("break_start", "Break started");
  const endBreak = () => void record("break_end", "Back on the clock");
  const clockOut = async () => {
    const ok = await confirm({
      title: "Clock out?",
      message: `You'll be clocked out at ${nowLabel()} with ${todayDuration} worked today.`,
      confirmLabel: "Clock Out",
      tone: "danger",
    });
    if (!ok) return;
    await record("clock_out", "Clocked out");
  };

  const statusText =
    phase === "in"
      ? "Currently Clocked In"
      : phase === "break"
        ? "On Break"
        : "Clocked Out";
  const statusColor =
    phase === "in"
      ? "text-status-complete"
      : phase === "break"
        ? "text-status-pending"
        : "text-brand-silver";

  return (
    <>
      <MobileHeader title="Time Clock" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-6 text-center border-b border-brand-ice/60 dark:border-white/10">
          <p className={cn("text-sm font-medium", statusColor)}>{statusText}</p>
          <div className="font-heading text-5xl font-bold tracking-tight text-brand-charcoal dark:text-white mt-2 tabular-nums">
            {hhmmss}
          </div>
          <p className="text-sm text-brand-steel mt-1">
            {summary.clockIn
              ? `Started at ${formatPacificTime(summary.clockIn)} · `
              : ""}
            {todayDuration} today
          </p>

          {phase !== "out" ? (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={clockOut}
                disabled={!canMutate}
                className="h-12 rounded bg-red-600 text-white font-heading font-semibold uppercase tracking-wide text-sm"
              >
                Clock Out
              </button>
              {phase === "in" ? (
                <button
                  onClick={startBreak}
                  disabled={!canMutate}
                  className="h-12 rounded border border-brand-ice dark:border-white/15 text-brand-charcoal dark:text-gray-200 font-medium text-sm"
                >
                  Start Break
                </button>
              ) : (
                <button
                  onClick={endBreak}
                  disabled={!canMutate}
                  className="h-12 rounded bg-status-pending text-white font-heading font-semibold uppercase tracking-wide text-sm"
                >
                  End Break
                </button>
              )}
            </div>
          ) : (
            <button
              disabled={!canMutate}
              onClick={() => void record("clock_in", "Clocked in")}
              className="mt-5 h-12 w-full rounded bg-brand-blue text-white font-heading font-semibold uppercase tracking-wide text-sm disabled:opacity-50"
            >
              Clock In
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 mt-3 p-4 border-y border-brand-ice/60 dark:border-white/10">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white mb-3">
            Today&apos;s Time Entries
          </h3>
          <ul className="space-y-3">
            {entries.map((e, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", dot[e.tone])} />
                <span className="text-sm text-brand-charcoal dark:text-gray-300 flex-1">
                  {e.label}
                </span>
                <span className="text-sm font-medium text-brand-charcoal dark:text-white tabular-nums">
                  {e.time}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 mt-3 p-4 border-y border-brand-ice/60 dark:border-white/10">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white mb-3">
            PTO & Time Requests
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded border border-brand-ice p-3">
              <div className="font-heading text-2xl font-bold text-brand-charcoal dark:text-white">
                {formatHoursDuration(driver?.ptoBalanceHours ?? 0)}
              </div>
              <div className="text-xs text-brand-steel">PTO balance</div>
            </div>
            <div className="rounded border border-brand-ice p-3">
              <div className="font-heading text-2xl font-bold text-brand-charcoal dark:text-white">
                {formatHoursDuration(driver?.weeklyHours ?? elapsed / 3600)}
              </div>
              <div className="text-xs text-brand-steel">This week</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              disabled={!canMutate}
              onClick={() => setRequestKind("edit_time")}
              className="min-h-11 rounded border border-brand-ice text-brand-blue disabled:text-brand-silver text-sm font-medium"
            >
              Change Time
            </button>
            <button
              disabled={!canMutate}
              onClick={() => setRequestKind("pto")}
              className="min-h-11 rounded border border-brand-ice text-brand-blue disabled:text-brand-silver text-sm font-medium"
            >
              Request PTO
            </button>
          </div>
          {requests.length > 0 && (
            <h4 className="mb-2 font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel dark:text-gray-400">
              Recent Requests
            </h4>
          )}
          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded bg-brand-mist dark:bg-white/5 px-3 py-2"
              >
                <span className="text-sm text-brand-charcoal dark:text-gray-200">
                  {request.kind === "pto" ? "PTO" : "Time edit"} ·{" "}
                  {formatHoursDuration(request.hours)}
                </span>
                <Badge
                  tone={request.status === "approved" ? "green" : "amber"}
                  label={request.status}
                />
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-brand-steel px-6 py-4 flex items-center justify-center gap-1.5">
          <Icon name="info" width={14} height={14} />
          Hours are reviewed by dispatch.
        </p>
      </div>
      {requestKind && (
        <TimeRequestModal
          open
          kind={requestKind}
          onClose={() => setRequestKind(null)}
        />
      )}
    </>
  );
}
