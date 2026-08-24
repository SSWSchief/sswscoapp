"use client";

import * as React from "react";
import { BottomNav } from "./BottomNav";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { DriverNotificationsPanel } from "./DriverNotificationsPanel";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { EnableAlertsBanner } from "@/components/system/EnableAlertsBanner";
import { DriverShellContext } from "./driver-context";
import { accessRoleLabel, effectivePermissions } from "@/lib/permissions";
import { driverSecondaryNav } from "@/components/navigation/routes";
import { PortalSwitch } from "@/components/navigation/PortalSwitch";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "ssws-driver-theme";

/**
 * Mobile-first driver shell that expands into a centered field workspace on
 * tablets and desktops. Night mode is persisted to reduce glare after dark.
 */
export function DriverShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { notificationsFor, currentUser } = useOperations();
  const { unreadMessageCount } = useExpandedOperations();
  const visibleMenu = currentUser
    ? driverSecondaryNav.filter(
        (item) => effectivePermissions(currentUser)[item.permission],
      )
    : [];
  // Includes unread messages so the bell reflects them too; see DispatcherShell.
  const unreadCount =
    (currentUser
      ? notificationsFor(currentUser.id).filter((item) => !item.acknowledgedAt)
          .length
      : 0) + unreadMessageCount;

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

  const signOut = async () => {
    await createClient().auth.signOut();
    setMenuOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <DriverShellContext.Provider
      value={{
        dark,
        toggle,
        openMenu: () => setMenuOpen(true),
        openNotifications: () => setNotificationsOpen(true),
        unreadCount,
      }}
    >
      <div className="app-viewport-height flex items-stretch justify-center bg-brand-navy/5 dark:bg-black">
        <div
          data-driver-portal
          className="relative w-full min-w-0 max-w-3xl overflow-hidden bg-white shadow-xl dark:bg-gray-950 lg:my-6 lg:rounded-xl lg:border lg:border-brand-ice/70"
        >
          <div className={dark ? "dark" : undefined}>
            <div className="app-fixed-height flex min-w-0 flex-col bg-surface dark:bg-gray-950 lg:h-[calc(100dvh-3rem)]">
              <EnableAlertsBanner />
              {children}
              <BottomNav />
            </div>
          </div>
          {menuOpen && (
            <div className="absolute inset-0 z-[85]">
              <button
                className="absolute inset-0 bg-brand-navy/55"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu backdrop"
              />
              <aside className="safe-area-bottom absolute left-0 top-0 flex h-full w-[82%] max-w-[330px] flex-col bg-white shadow-2xl dark:bg-gray-900">
                <div className="safe-drawer-header flex items-center justify-between border-b border-brand-ice px-4 dark:border-white/10">
                  <LogoFull className="scale-110 origin-left" />
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="text-brand-steel"
                    aria-label="Close menu"
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <nav
                  className="flex-1 overflow-y-auto p-3 space-y-1"
                  aria-label="More navigation"
                >
                  <PortalSwitch
                    tone="light"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  {visibleMenu.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 rounded px-3 py-3 text-sm font-semibold ${pathname.startsWith(item.href) ? "bg-brand-blue text-white" : "text-brand-charcoal dark:text-gray-100"}`}
                    >
                      <Icon name={item.icon} /> {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="space-y-2 border-t border-brand-ice p-3 dark:border-white/10">
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm font-semibold text-brand-charcoal dark:text-gray-100"
                  >
                    <Icon name="settings" />
                    <span className="flex-1 text-left">Night Mode</span>
                    <span className="text-xs text-brand-steel">
                      {dark ? "On" : "Off"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm font-semibold text-red-600"
                  >
                    <Icon name="logout" /> Log Out
                  </button>
                  <div className="px-3 pb-1 text-xs text-brand-steel">
                    {currentUser?.fullName} ·{" "}
                    {currentUser ? accessRoleLabel[currentUser.accessRole] : ""}
                  </div>
                </div>
              </aside>
            </div>
          )}
          <DriverNotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>
      </div>
    </DriverShellContext.Provider>
  );
}
