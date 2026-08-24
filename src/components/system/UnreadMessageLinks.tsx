"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { useExpandedOperations } from "./ExpandedOperationsProvider";

/**
 * Unread conversations, shown at the top of the notifications panel.
 *
 * The bell counts unread messages, so tapping it has to explain the number —
 * a badge that opens an empty panel reads as a bug. Each row deep-links to the
 * thread, which marks it read on arrival.
 */
export function UnreadMessageLinks({
  basePath,
  onNavigate,
}: {
  basePath: "/dispatcher/messages" | "/driver/messages";
  onNavigate: () => void;
}) {
  const { unreadChannels } = useExpandedOperations();
  if (!unreadChannels.length) return null;

  return (
    <div className="border-b border-brand-ice/60 dark:border-white/10">
      <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-steel">
        Unread messages
      </p>
      <ul className="divide-y divide-brand-ice/50 dark:divide-white/10">
        {unreadChannels.map((channel) => (
          <li key={channel.id}>
            <Link
              href={`${basePath}?channel=${encodeURIComponent(channel.id)}`}
              onClick={onNavigate}
              className="flex items-start gap-2.5 px-4 py-3 hover:bg-brand-mist dark:hover:bg-white/5"
            >
              <span className="mt-0.5 shrink-0 text-brand-blue">
                <Icon name="messages" width={16} height={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-brand-charcoal dark:text-white">
                    {channel.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {channel.unread}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-brand-steel dark:text-gray-400">
                  {channel.lastBody}
                </span>
                <span className="mt-1 block text-xs text-brand-silver">
                  <RelativeTime iso={channel.lastAt} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
