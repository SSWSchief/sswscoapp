"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { dispatcherNav } from "./nav";

/** Desktop sidebar. The mobile drawer reuses `dispatcherNav` from ./nav. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-brand text-white">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10">
        <Icon name="truck" className="text-white" />
        <span className="font-bold tracking-tight">SSWS</span>
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon name={item.icon} width={18} height={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/10">
          <Avatar
            initials="DP"
            size="sm"
            colorful={false}
            className="bg-white/15 text-white"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Daniel Perez</div>
            <div className="text-xs text-white/50">Dispatcher</div>
          </div>
          <Icon name="chevron-down" width={16} height={16} className="text-white/50" />
        </div>
      </div>
    </aside>
  );
}
