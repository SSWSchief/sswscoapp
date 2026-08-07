"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/Logo";
import { useDriverTheme } from "./driver-context";

/** Top bar for driver screens. `back` renders a back chevron to the given href. */
export function MobileHeader({
  title,
  back,
}: {
  title: string;
  back?: string;
}) {
  const { openNotifications, unreadCount } = useDriverTheme();
  return (
    <header className="safe-header safe-area-x grid shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center bg-white border-b border-brand-ice/70 dark:bg-gray-900 dark:border-white/10">
      <div className="flex justify-start">
        {back ? (
          <Link
            href={back}
            className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center text-brand-steel dark:text-gray-300"
            aria-label="Back"
          >
            <Icon name="chevron-right" className="rotate-180" />
          </Link>
        ) : null}
      </div>
      <Link href="/driver/jobs" className="mx-auto flex min-w-0 items-center gap-2" aria-label="SSWSCO home">
        <LogoMark className="h-9 w-10" />
        <h1 className="truncate font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">{title}</h1>
      </Link>
      <button
        onClick={openNotifications}
        className="relative -mr-2 inline-flex min-h-11 min-w-11 items-center justify-center justify-self-end text-brand-steel dark:text-gray-400"
        aria-label="Notifications"
      >
        <Icon name="bell" width={22} height={22} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">{unreadCount}</span>}
      </button>
    </header>
  );
}
