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
        className="absolute right-4 top-16 w-[360px] max-w-[calc(100vw-2rem)] rounded-card bg-white shadow-2xl border border-gray-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close notifications"
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>
        <ul className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  <p className="text-sm text-gray-500">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    <RelativeTime iso={m.createdAt} />
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2.5 border-t border-gray-100 text-center">
          <button className="text-sm font-medium text-brand-500 hover:underline">
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
}
