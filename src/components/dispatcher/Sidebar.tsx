"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useOperations } from "@/components/system/OperationsProvider";
import { LogoFull } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { effectivePermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { dispatcherNavSections } from "./nav";

/** Desktop sidebar. The mobile drawer reuses `dispatcherNav` from ./nav. */
export function Sidebar() {
  const { currentUser } = useOperations();
  const pathname = usePathname();
  const router = useRouter();
  const permissions = currentUser ? effectivePermissions(currentUser) : null;
  const visibleSections = dispatcherNavSections
    .map(section => ({ ...section, items: permissions ? section.items.filter(item => permissions[item.permission]) : section.items }))
    .filter(section => section.items.length > 0);
  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-brand-navy text-white">
      <div className="h-24 flex items-center px-3 border-b border-white/10 bg-white">
        <LogoFull markClassName="h-20 w-48" />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
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
                      : "text-brand-ice hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon name={item.icon} width={18} height={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left hover:bg-white/10">
          <Avatar
            initials={currentUser?.initials ?? "--"}
            size="sm"
            colorful={false}
            className="bg-brand-blue/25 text-brand-ice"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{currentUser?.fullName ?? "Loading account"}</div>
            <div className="text-xs capitalize text-brand-ice/70">{currentUser?.accessRole ?? ""}</div>
          </div>
          <Icon name="logout" width={16} height={16} className="text-brand-ice/70" />
        </button>
      </div>
    </aside>
  );
}
