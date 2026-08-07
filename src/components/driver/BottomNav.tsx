"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useOperations } from "@/components/system/OperationsProvider";
import { effectivePermissions } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/types";

const tabs: { href: string; label: string; icon: IconName;permission:PermissionKey }[] = [
  { href: "/driver/jobs", label: "Home", icon: "dashboard",permission:"driver_jobs" },
  { href: "/driver/time-clock", label: "Time Clock", icon: "clock",permission:"time_clock" },
  { href: "/driver/messages", label: "Messages", icon: "messages",permission:"messages" },
  { href: "/driver/sops", label: "SOPs", icon: "clipboard",permission:"sops" },
  { href: "/driver/profile", label: "More", icon: "more",permission:"profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const {currentUser}=useOperations();const visible=currentUser?tabs.filter(t=>effectivePermissions(currentUser)[t.permission]):[];
  return (
    <nav className="safe-area-bottom shrink-0 border-t border-brand-ice/70 bg-white dark:bg-gray-900 dark:border-white/10">
      <div className="flex">
        {visible.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-w-0 flex-1 flex flex-col items-center gap-1 py-2.5 font-heading text-[9px] font-medium uppercase tracking-wide min-[390px]:text-[10px]",
                active
                  ? "text-brand-blue"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              <Icon name={t.icon} width={22} height={22} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
