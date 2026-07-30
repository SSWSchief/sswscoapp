"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { CURRENT_DRIVER_ID, getTimeRequests, getUser } from "@/lib/data";
import { cn } from "@/lib/utils";

// Screen 7 — Time Clock (driver). State machine: clocked in ⇄ on break → out.
type Phase = "in" | "break" | "out";

interface Entry {
  label: string;
  time: string;
  tone: "green" | "amber" | "gray";
}

const dot = {
  green: "bg-status-complete",
  amber: "bg-status-pending",
  gray: "bg-brand-silver dark:bg-gray-600",
};

function nowLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DriverTimeClockPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const driver = getUser(CURRENT_DRIVER_ID);
  const requests = getTimeRequests().filter((r) => r.userId === CURRENT_DRIVER_ID);

  const [phase, setPhase] = React.useState<Phase>("in");
  const [elapsed, setElapsed] = React.useState(9918); // seed ~2:45:18
  const [entries, setEntries] = React.useState<Entry[]>([
    { label: "Clock In", time: "7:30 AM", tone: "green" },
  ]);

  // Running work timer (pauses on break / after clock out).
  React.useEffect(() => {
    if (phase !== "in") return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const hhmmss = React.useMemo(() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsed]);

  const totalHours = (elapsed / 3600).toFixed(2);

  const startBreak = () => {
    setPhase("break");
    setEntries((e) => [...e, { label: "Start Break", time: nowLabel(), tone: "amber" }]);
    toast("Break started", { tone: "info" });
  };
  const endBreak = () => {
    setPhase("in");
    setEntries((e) => [...e, { label: "End Break", time: nowLabel(), tone: "amber" }]);
    toast("Back on the clock", { tone: "success" });
  };
  const clockOut = async () => {
    const ok = await confirm({
      title: "Clock out?",
      message: `You'll be clocked out at ${nowLabel()} with ${totalHours} hours today.`,
      confirmLabel: "Clock Out",
      tone: "danger",
    });
    if (!ok) return;
    setPhase("out");
    setEntries((e) => [...e, { label: "Clock Out", time: nowLabel(), tone: "gray" }]);
    toast("Clocked out", { tone: "success" });
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
      <MobileHeader title="Time Clock" menu />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-6 text-center border-b border-brand-ice/60 dark:border-white/10">
          <p className={cn("text-sm font-medium", statusColor)}>{statusText}</p>
          <div className="font-heading text-5xl font-bold tracking-tight text-brand-charcoal dark:text-white mt-2 tabular-nums">
            {hhmmss}
          </div>
          <p className="text-sm text-brand-steel mt-1">
            Started at 7:30 AM · {totalHours} hrs today
          </p>

          {phase !== "out" ? (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={clockOut}
                className="h-12 rounded bg-red-600 text-white font-heading font-semibold uppercase tracking-wide text-sm"
              >
                Clock Out
              </button>
              {phase === "in" ? (
                <button
                  onClick={startBreak}
                  className="h-12 rounded border border-brand-ice dark:border-white/15 text-brand-charcoal dark:text-gray-200 font-medium text-sm"
                >
                  Start Break
                </button>
              ) : (
                <button
                  onClick={endBreak}
                  className="h-12 rounded bg-status-pending text-white font-heading font-semibold uppercase tracking-wide text-sm"
                >
                  End Break
                </button>
              )}
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 h-12 text-brand-steel font-medium text-sm">
              <Icon name="check" width={18} height={18} />
              Shift complete — {totalHours} hours
            </div>
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
                {driver?.ptoBalanceHours ?? 0}h
              </div>
              <div className="text-xs text-brand-steel">PTO balance</div>
            </div>
            <div className="rounded border border-brand-ice p-3">
              <div className="font-heading text-2xl font-bold text-brand-charcoal dark:text-white">
                {driver?.weeklyHours ?? totalHours}h
              </div>
              <div className="text-xs text-brand-steel">This week</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button className="h-10 rounded border border-brand-blue/40 text-brand-blue text-sm font-medium">
              Change Time
            </button>
            <button className="h-10 rounded border border-brand-blue/40 text-brand-blue text-sm font-medium">
              PTO Option
            </button>
          </div>
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded bg-brand-mist dark:bg-white/5 px-3 py-2">
                <span className="text-sm text-brand-charcoal dark:text-gray-200">
                  {request.kind === "pto" ? "PTO" : "Time edit"} · {request.hours}h
                </span>
                <Badge tone={request.status === "approved" ? "green" : "amber"} label={request.status} />
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-brand-steel px-6 py-4 flex items-center justify-center gap-1.5">
          <Icon name="info" width={14} height={14} />
          Hours are reviewed by dispatch.
        </p>
      </div>
    </>
  );
}
