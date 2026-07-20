"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/driver/jobs", label: "My Jobs", icon: "jobs" },
  { href: "/driver/time-clock", label: "Time Clock", icon: "clock" },
  { href: "/driver/messages", label: "Messages", icon: "messages" },
  { href: "/driver/profile", label: "More", icon: "more" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="shrink-0 border-t border-gray-200 bg-white dark:bg-gray-900 dark:border-white/10">
      <div className="flex">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active
                  ? "text-brand-500"
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
