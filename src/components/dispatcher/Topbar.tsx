"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { useDispatcherUI } from "./shell-context";

/** Page header across the top of every dispatcher screen. */
export function Topbar({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  const { openDrawer, openCommand, openNotifications, unreadCount } =
    useDispatcherUI();

  return (
    <header className="safe-topbar safe-area-x shrink-0 bg-white border-b border-brand-ice/70 flex items-center justify-between gap-2 sm:gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={openDrawer}
          className="md:hidden rounded p-2 -ml-2 text-brand-steel hover:bg-brand-mist"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>
        <h1 className="truncate font-heading text-lg font-semibold uppercase tracking-normal text-brand-charcoal min-[390px]:text-xl min-[390px]:tracking-wide">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={openCommand}
          className="hidden sm:flex items-center gap-2 h-9 rounded border border-brand-ice pl-3 pr-2 text-sm text-brand-steel hover:bg-brand-mist"
          aria-label="Search"
        >
          <Icon name="search" width={16} height={16} />
          <span>Search…</span>
          <kbd className="text-[11px] text-brand-steel border border-brand-ice rounded-sm px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={openCommand}
          className="sm:hidden rounded p-2 text-brand-steel hover:bg-brand-mist"
          aria-label="Search"
        >
          <Icon name="search" />
        </button>

        <button
          onClick={openNotifications}
          className="relative rounded p-2 text-brand-steel hover:bg-brand-mist"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Icon name="bell" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        {action}
      </div>
    </header>
  );
}
