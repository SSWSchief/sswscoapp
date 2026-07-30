import { MobileHeader } from "@/components/driver/MobileHeader";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { getMessageThreads } from "@/lib/data";

// Screen 17 — Messages / Announcements (driver).
export default function DriverMessagesPage() {
  const threads = getMessageThreads();

  return (
    <>
      <MobileHeader title="Messages" menu />

      <div className="shrink-0 flex border-b border-brand-ice/70 bg-white dark:bg-gray-900 dark:border-white/10">
        <button className="flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-steel dark:text-gray-500">
          Messages
        </button>
        <button className="flex-1 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue">
          Announcements
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950 p-4 space-y-3">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="rounded-card bg-white dark:bg-gray-900 border border-brand-ice/70 dark:border-white/10 shadow-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">
                {thread.channel}
              </h3>
              <p className="text-xs text-brand-silver">
                <RelativeTime iso={thread.updatedAt} />
              </p>
            </div>
            <p className="text-sm font-medium text-brand-charcoal dark:text-white mt-1">
              {thread.title}
            </p>
            <div className="mt-3 space-y-2">
              {thread.messages.map((message) => (
                <div key={message.id} className="rounded bg-brand-mist dark:bg-white/5 px-3 py-2">
                  <div className="text-xs font-semibold text-brand-blue">{message.title}</div>
                  <p className="text-sm text-brand-steel dark:text-gray-400">{message.body}</p>
                </div>
              ))}
              </div>
          </div>
        ))}
      </div>
    </>
  );
}
