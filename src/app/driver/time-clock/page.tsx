"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/system/ToastProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
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
  gray: "bg-gray-300 dark:bg-gray-600",
};

function nowLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DriverTimeClockPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

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
      : "text-gray-400";

  return (
    <>
      <MobileHeader title="Time Clock" menu />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-6 text-center border-b border-gray-100 dark:border-white/10">
          <p className={cn("text-sm font-medium", statusColor)}>{statusText}</p>
          <div className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mt-2 tabular-nums">
            {hhmmss}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Started at 7:30 AM · {totalHours} hrs today
          </p>

          {phase !== "out" ? (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={clockOut}
                className="h-12 rounded-lg bg-red-500 text-white font-semibold text-sm"
              >
                Clock Out
              </button>
              {phase === "in" ? (
                <button
                  onClick={startBreak}
                  className="h-12 rounded-lg border border-gray-300 dark:border-white/15 text-gray-700 dark:text-gray-200 font-medium text-sm"
                >
                  Start Break
                </button>
              ) : (
                <button
                  onClick={endBreak}
                  className="h-12 rounded-lg bg-status-pending text-white font-semibold text-sm"
                >
                  End Break
                </button>
              )}
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 h-12 text-gray-500 font-medium text-sm">
              <Icon name="check" width={18} height={18} />
              Shift complete — {totalHours} hours
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 mt-3 p-4 border-y border-gray-100 dark:border-white/10">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Today&apos;s Time Entries
          </h3>
          <ul className="space-y-3">
            {entries.map((e, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", dot[e.tone])} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {e.label}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                  {e.time}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-xs text-gray-400 px-6 py-4 flex items-center justify-center gap-1.5">
          <Icon name="info" width={14} height={14} />
          Hours are reviewed by dispatch.
        </p>
      </div>
    </>
  );
}
