import { MobileHeader } from "@/components/driver/MobileHeader";
import { getMessages } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/utils";

// Screen 17 — Messages / Announcements (driver).
export default function DriverMessagesPage() {
  const messages = getMessages();

  return (
    <>
      <MobileHeader title="Messages" menu />

      <div className="shrink-0 flex border-b border-gray-200 bg-white">
        <button className="flex-1 py-3 text-sm font-medium text-gray-400">
          Messages
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-brand-500 border-b-2 border-brand-500">
          Announcements
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className="rounded-card bg-white border border-gray-200 shadow-card p-4"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {m.title}
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">{m.body}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {formatDate(m.createdAt)} · {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
