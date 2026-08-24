"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { LogoFull } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { effectivePermissions } from "@/lib/permissions";
import { staffNavSections } from "@/components/navigation/routes";
import { PortalSwitch } from "@/components/navigation/PortalSwitch";
import { DispatcherAccount } from "./DispatcherAccount";

/** Desktop sidebar. The mobile drawer reuses `dispatcherNav` from ./nav. */
export function Sidebar() {
  const { currentUser } = useOperations();
  const { unreadMessageCount } = useExpandedOperations();
  const pathname = usePathname();
  const permissions = currentUser ? effectivePermissions(currentUser) : null;
  const visibleSections = staffNavSections
    .map((section) => ({
      ...section,
      items: permissions
        ? section.items.filter((item) => permissions[item.permission])
        : section.items,
    }))
    .filter((section) => section.items.length > 0);
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-brand-navy text-white">
      <div className="h-24 flex items-center px-3 border-b border-white/10 bg-white">
        <LogoFull markClassName="h-20 w-48" />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        <PortalSwitch />
        {visibleSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-ice/55">
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded px-3 py-2 font-heading text-sm font-medium uppercase tracking-wide transition-colors",
                    active
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-brand-ice hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="relative flex shrink-0">
                    <Icon name={item.icon} width={18} height={18} />
                    {item.icon === "messages" && unreadMessageCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-red-500 px-1 text-[9px] font-bold leading-[15px] text-white text-center">
                        {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <DispatcherAccount />
      </div>
    </aside>
  );
}
