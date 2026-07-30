"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPanel } from "./NotificationsPanel";
import { DispatcherUIContext } from "./shell-context";
import { dispatcherNav } from "./nav";
import { Icon } from "@/components/ui/Icon";
import { LogoFull } from "@/components/ui/Logo";
import { getMessages } from "@/lib/data";
import { cn } from "@/lib/utils";

export function DispatcherShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = React.useState(false);
  const [command, setCommand] = React.useState(false);
  const [notifications, setNotifications] = React.useState(false);
  const pathname = usePathname();
  const unreadCount = getMessages().length;

  // Global ⌘K / Ctrl+K to open the command palette.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer on navigation.
  React.useEffect(() => setDrawer(false), [pathname]);

  return (
    <DispatcherUIContext.Provider
      value={{
        openDrawer: () => setDrawer(true),
        openCommand: () => setCommand(true),
        openNotifications: () => setNotifications((n) => !n),
        unreadCount,
      }}
    >
      <div className="flex h-screen overflow-hidden bg-surface text-brand-charcoal">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div
            className="absolute inset-0 bg-brand-navy/50"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-brand-navy text-white shadow-xl flex flex-col">
            <div className="h-20 flex items-center justify-between px-4 border-b border-white/10 bg-white">
              <LogoFull />
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
                className="text-brand-navy hover:text-brand-blue"
              >
                <Icon name="close" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {dispatcherNav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded px-3 py-2.5 font-heading text-sm font-medium uppercase tracking-wide",
                      active
                        ? "bg-brand-blue text-white"
                        : "text-brand-ice hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon name={item.icon} width={18} height={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <CommandPalette open={command} onClose={() => setCommand(false)} />
      <NotificationsPanel
        open={notifications}
        onClose={() => setNotifications(false)}
      />
    </DispatcherUIContext.Provider>
  );
}
