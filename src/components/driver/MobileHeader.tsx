"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/Logo";
import { useDriverTheme } from "./driver-context";

/** Top bar for driver screens. `back` renders a back chevron to the given href. */
export function MobileHeader({
  title,
  back,
  menu,
}: {
  title: string;
  back?: string;
  menu?: boolean;
}) {
  const { openMenu, openNotifications, unreadCount } = useDriverTheme();
  return (
    <header className="safe-header safe-area-x shrink-0 bg-white border-b border-brand-ice/70 flex items-center justify-between dark:bg-gray-900 dark:border-white/10">
      <div className="w-8">
        {back ? (
          <Link
            href={back}
            className="text-brand-steel dark:text-gray-300 -ml-1 inline-flex"
            aria-label="Back"
          >
            <Icon name="chevron-right" className="rotate-180" />
          </Link>
        ) : menu ? (
          <button onClick={openMenu} className="text-brand-steel dark:text-gray-300 -ml-1" aria-label="Menu">
            <Icon name="menu" />
          </button>
        ) : null}
      </div>
      <Link href="/driver/jobs" className="flex min-w-0 items-center gap-2" aria-label="SSWSCO home">
        <LogoMark className="h-9 w-10" />
        <h1 className="truncate font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">{title}</h1>
      </Link>
      <button
        onClick={openNotifications}
        className="relative w-8 text-brand-steel dark:text-gray-400 flex justify-end"
        aria-label="Notifications"
      >
        <Icon name="bell" width={22} height={22} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">{unreadCount}</span>}
      </button>
    </header>
  );
}
