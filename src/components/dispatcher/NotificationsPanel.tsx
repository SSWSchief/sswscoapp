"use client";

import { Icon } from "@/components/ui/Icon";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { useOperations } from "@/components/system/OperationsProvider";
import { UnreadMessageLinks } from "@/components/system/UnreadMessageLinks";

export function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    notificationsFor,
    acknowledgeNotification,
    acknowledgeAll,
    currentUser,
  } = useOperations();
  const recipientId = currentUser?.id ?? "";
  const messages = notificationsFor(recipientId);
  const unread = messages.filter((message) => !message.acknowledgedAt);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Notifications"
        className="absolute inset-0 flex flex-col bg-white shadow-2xl sm:inset-auto sm:right-4 sm:top-16 sm:max-h-[calc(100dvh-5rem)] sm:w-[360px] sm:max-w-[calc(100vw-2rem)] sm:rounded-card sm:border sm:border-brand-ice overflow-hidden"
      >
        <div className="safe-header flex shrink-0 items-center justify-between bg-brand-navy px-4 pb-3">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Notifications
          </h2>
          <button
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center text-white/70 hover:text-white"
            aria-label="Close notifications"
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto sm:max-h-[420px]">
          <UnreadMessageLinks
            basePath="/dispatcher/messages"
            onNavigate={onClose}
          />
          {messages.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-brand-steel">
              No notifications yet.
            </p>
          ) : null}
          <ul className="divide-y divide-brand-ice/50">
            {messages.map((m) => (
            <li key={m.id} className="px-4 py-3 hover:bg-brand-mist">
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${m.acknowledgedAt ? "bg-brand-silver" : "bg-brand-blue"}`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-charcoal">
                    {m.title}
                  </p>
                  <p className="text-sm text-brand-steel">{m.body}</p>
                  <p className="text-xs text-brand-silver mt-1">
                    <RelativeTime iso={m.createdAt} />
                  </p>
                  {m.requiresAcknowledgement && !m.acknowledgedAt ? (
                    <button
                      onClick={() => acknowledgeNotification(m.id)}
                      className="mt-2 rounded bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Icon name="check" width={13} height={13} /> Acknowledged
                    </span>
                  )}
                </div>
              </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="safe-area-bottom-padded shrink-0 px-4 pt-2.5 border-t border-brand-ice/60 text-center">
          <button
            onClick={() => acknowledgeAll(recipientId)}
            disabled={unread.length === 0}
            className="min-h-11 text-sm font-medium text-brand-blue hover:underline disabled:text-brand-silver disabled:no-underline"
          >
            Acknowledge all ({unread.length})
          </button>
        </div>
      </div>
    </div>
  );
}
