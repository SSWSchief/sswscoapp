"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { staffMobileNav } from "@/components/navigation/routes";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { effectivePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useDispatcherUI } from "./shell-context";

export function DispatcherBottomNav() {
  const pathname = usePathname();
  const { currentUser } = useOperations();
  const { openDrawer } = useDispatcherUI();
  const permissions = currentUser ? effectivePermissions(currentUser) : null;
  const tabs = permissions
    ? staffMobileNav.filter((item) => permissions[item.permission])
    : [];
  const primaryActive = tabs.some((item) => pathname.startsWith(item.href));

  return (
    <nav
      className="safe-area-bottom shrink-0 border-t border-brand-ice/70 bg-white md:hidden"
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
                active ? "text-brand-blue" : "text-brand-silver",
              )}
            >
              <Icon name={item.icon} width={22} height={22} />
              <span className="truncate">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={openDrawer}
          aria-label="More navigation"
          aria-current={!primaryActive ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 font-heading text-[9px] font-medium uppercase tracking-wide min-[390px]:text-[10px]",
            !primaryActive ? "text-brand-blue" : "text-brand-silver",
          )}
        >
          <Icon name="more" width={22} height={22} />
          More
        </button>
      </div>
    </nav>
  );
}
