import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";

// Screen 7 — Time Clock (driver). Static skeleton of the clocked-in state.
const entries = [
  { label: "Clock In", time: "7:30 AM", tone: "green" as const },
  { label: "Start Break", time: "10:00 AM", tone: "amber" as const },
  { label: "End Break", time: "10:15 AM", tone: "amber" as const },
  { label: "Clock Out", time: "—", tone: "gray" as const },
];

const dot = { green: "bg-status-complete", amber: "bg-status-pending", gray: "bg-gray-300" };

export default function DriverTimeClockPage() {
  return (
    <>
      <MobileHeader title="Time Clock" menu />

      <div className="flex-1 overflow-y-auto bg-surface">
        {/* Live clock card */}
        <div className="bg-white p-6 text-center border-b border-gray-100">
          <p className="text-sm font-medium text-status-complete">
            Currently Clocked In
          </p>
          <div className="text-5xl font-bold tracking-tight text-gray-900 mt-2 tabular-nums">
            2:45:18
          </div>
          <p className="text-sm text-gray-400 mt-1">Started at 7:30 AM</p>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button className="h-11 rounded-lg bg-red-500 text-white font-medium text-sm">
              Clock Out
            </button>
            <button className="h-11 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm">
              Start Break
            </button>
          </div>
        </div>

        {/* Today's entries */}
        <div className="bg-white mt-3 p-4 border-y border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Today&apos;s Time Entries
          </h3>
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.label} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dot[e.tone]}`} />
                <span className="text-sm text-gray-700 flex-1">{e.label}</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">
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
