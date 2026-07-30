"use client";

import { Icon } from "@/components/ui/Icon";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { getMessages } from "@/lib/data";

export function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const messages = getMessages();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Notifications"
        className="absolute right-4 top-16 w-[360px] max-w-[calc(100vw-2rem)] rounded-card bg-white shadow-2xl border border-brand-ice overflow-hidden"
      >
        <div className="flex items-center justify-between bg-brand-navy px-4 py-3">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Notifications
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white"
            aria-label="Close notifications"
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>
        <ul className="max-h-[420px] overflow-y-auto divide-y divide-brand-ice/50">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-3 hover:bg-brand-mist">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-blue shrink-0" />
                <div>
                  <p className="text-sm font-medium text-brand-charcoal">{m.title}</p>
                  <p className="text-sm text-brand-steel">{m.body}</p>
                  <p className="text-xs text-brand-silver mt-1">
                    <RelativeTime iso={m.createdAt} />
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2.5 border-t border-brand-ice/60 text-center">
          <button className="text-sm font-medium text-brand-blue hover:underline">
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
}
