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
    <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={openDrawer}
          className="md:hidden rounded-lg p-2 -ml-2 text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Icon name="menu" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={openCommand}
          className="hidden sm:flex items-center gap-2 h-9 rounded-lg border border-gray-200 pl-3 pr-2 text-sm text-gray-400 hover:bg-gray-50"
          aria-label="Search"
        >
          <Icon name="search" width={16} height={16} />
          <span>Search…</span>
          <kbd className="text-[11px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={openCommand}
          className="sm:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Search"
        >
          <Icon name="search" />
        </button>

        <button
          onClick={openNotifications}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
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
