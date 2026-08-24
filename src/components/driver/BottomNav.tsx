"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  driverPrimaryNav,
  driverSecondaryNav,
} from "@/components/navigation/routes";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { effectivePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useDriverTheme } from "./driver-context";

export function BottomNav() {
  const pathname = usePathname();
  const { currentUser } = useOperations();
  const { unreadMessageCount } = useExpandedOperations();
  const { openMenu } = useDriverTheme();
  const permissions = currentUser ? effectivePermissions(currentUser) : null;
  const tabs = permissions
    ? driverPrimaryNav.filter((item) => permissions[item.permission])
    : [];
  const moreActive = driverSecondaryNav.some((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <nav
      className="safe-area-bottom shrink-0 border-t border-brand-ice/70 bg-white dark:border-white/10 dark:bg-gray-900"
      aria-label="Primary navigation"
    >
      <div className="flex">
        {tabs.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 font-heading text-[9px] font-medium uppercase tracking-wide min-[390px]:text-[10px]",
                active ? "text-brand-blue" : "text-gray-400 dark:text-gray-500",
              )}
            >
              <span className="relative flex">
                <Icon name={item.icon} width={22} height={22} />
                {item.icon === "messages" && unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] rounded-full bg-red-500 px-1 text-[9px] font-bold leading-[15px] text-white text-center">
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </span>
                )}
              </span>
              <span className="truncate">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={openMenu}
          aria-label="More navigation"
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 font-heading text-[9px] font-medium uppercase tracking-wide min-[390px]:text-[10px]",
            moreActive ? "text-brand-blue" : "text-gray-400 dark:text-gray-500",
          )}
        >
          <Icon name="more" width={22} height={22} />
          More
        </button>
      </div>
    </nav>
  );
}
