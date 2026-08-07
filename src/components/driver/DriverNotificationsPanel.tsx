"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { useOperations } from "@/components/system/OperationsProvider";

export function DriverNotificationsPanel({
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
  const notifications = notificationsFor(recipientId);
  const unread = notifications.filter((item) => !item.acknowledgedAt);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-surface dark:bg-gray-950">
      <header className="safe-header shrink-0 bg-brand-navy px-4 pb-3 text-white flex items-center justify-between">
        <h2 className="font-heading font-semibold uppercase tracking-wide">
          Notifications
        </h2>
        <button onClick={onClose} aria-label="Close notifications">
          <Icon name="close" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-card bg-white p-6 text-center text-sm text-brand-steel dark:bg-gray-900">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <article
              key={notification.id}
              className="rounded-card border border-brand-ice bg-white p-4 shadow-card dark:border-white/10 dark:bg-gray-900"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.acknowledgedAt ? "bg-brand-silver" : "bg-brand-blue"}`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-brand-charcoal dark:text-white">
                    {notification.title}
                  </h3>
                  <p className="mt-1 text-sm text-brand-steel dark:text-gray-400">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-xs text-brand-silver">
                    <RelativeTime iso={notification.createdAt} />
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {!notification.acknowledgedAt ? (
                      <button
                        onClick={() => acknowledgeNotification(notification.id)}
                        className="rounded bg-brand-blue px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Icon name="check" width={14} height={14} />{" "}
                        Acknowledged
                      </span>
                    )}
                    {notification.relatedJobId && (
                      <Link
                        onClick={onClose}
                        href={`/driver/jobs/${notification.relatedJobId}`}
                        className="px-2 py-2 text-xs font-semibold text-brand-blue"
                      >
                        View Job
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="safe-area-bottom-padded shrink-0 border-t border-brand-ice bg-white px-4 pt-4 dark:border-white/10 dark:bg-gray-900">
        <button
          onClick={() => acknowledgeAll(recipientId)}
          disabled={!unread.length}
          className="h-11 w-full rounded border border-brand-blue text-sm font-semibold text-brand-blue disabled:border-brand-ice disabled:text-brand-silver"
        >
          Acknowledge all ({unread.length})
        </button>
      </div>
    </div>
  );
}
