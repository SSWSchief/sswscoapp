"use client";

import * as React from "react";
import { BottomNav } from "./BottomNav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DriverNotificationsPanel } from "./DriverNotificationsPanel";
import { useOperations } from "@/components/system/OperationsProvider";
import { DriverShellContext } from "./driver-context";
import { effectivePermissions } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/types";
export { useDriverTheme } from "./driver-context";

const STORAGE_KEY = "ssws-driver-theme";

/**
 * Mobile-first driver shell. It stays full-width on phones and tablets, then
 * presents inside a phone frame on large desktops. Supports an optional night mode (persisted)
 * to cut glare on evening pickups.
 */
export function DriverShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const pathname = usePathname();
  const { notificationsFor, currentUser } = useOperations();
  const visibleMenu=currentUser?driverMenu.filter(item=>effectivePermissions(currentUser)[item.permission]):[];
  const unreadCount = currentUser ? notificationsFor(currentUser.id).filter((item) => !item.acknowledgedAt).length : 0;

  React.useEffect(() => {
    setDark(localStorage.getItem(STORAGE_KEY) === "dark");
  }, []);

  const toggle = React.useCallback(() => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return (
    <DriverShellContext.Provider value={{ dark, toggle, openMenu: () => setMenuOpen(true), openNotifications: () => setNotificationsOpen(true), unreadCount }}>
      <div className="app-viewport-height bg-brand-navy flex items-center justify-center xl:py-8 dark:bg-black">
        <div className="relative w-full max-w-full min-w-0 xl:max-w-[420px] xl:rounded-[2.25rem] xl:border-[10px] xl:border-brand-charcoal xl:shadow-2xl overflow-hidden bg-white dark:bg-gray-950">
          <div className={dark ? "dark" : undefined}>
            <div className="app-fixed-height flex min-w-0 flex-col xl:h-[860px] bg-surface dark:bg-gray-950">
              {children}
              <BottomNav />
            </div>
          </div>
          {menuOpen && (
            <div className="absolute inset-0 z-[85]">
              <button className="absolute inset-0 bg-brand-navy/55" onClick={() => setMenuOpen(false)} aria-label="Close menu backdrop" />
              <aside className="safe-area-bottom absolute left-0 top-0 flex h-full w-[82%] max-w-[330px] flex-col bg-white shadow-2xl dark:bg-gray-900">
                <div className="safe-drawer-header flex items-center justify-between border-b border-brand-ice px-4 dark:border-white/10">
                  <LogoFull className="scale-110 origin-left" />
                  <button onClick={() => setMenuOpen(false)} className="text-brand-steel" aria-label="Close menu"><Icon name="close" /></button>
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {visibleMenu.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded px-3 py-3 text-sm font-semibold ${pathname.startsWith(item.href) ? "bg-brand-blue text-white" : "text-brand-charcoal dark:text-gray-100"}`}>
                      <Icon name={item.icon} /> {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="border-t border-brand-ice p-4 text-xs text-brand-steel dark:border-white/10">SSWSCO Overwatch · Live operations</div>
              </aside>
            </div>
          )}
          <DriverNotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
        </div>
      </div>
    </DriverShellContext.Provider>
  );
}

const driverMenu: { href: string; label: string; icon: IconName;permission:PermissionKey }[] = [
  { href: "/driver/jobs", label: "Home / My Jobs", icon: "dashboard",permission:"driver_jobs" },
  { href: "/driver/pre-trip", label: "Electronic Pre-Trip", icon: "clipboard",permission:"pre_trip" },
  { href: "/driver/time-clock", label: "Time Clock", icon: "clock",permission:"time_clock" },
  { href: "/driver/messages", label: "Messages", icon: "messages",permission:"messages" },
  { href: "/driver/sops", label: "SOPs", icon: "jobs",permission:"sops" },
  { href: "/driver/profile", label: "Profile", icon: "user",permission:"profile" },
];
