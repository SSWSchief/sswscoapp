"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { effectivePermissions } from "@/lib/permissions";
import { availablePortals } from "@/lib/portal-access";
import { cn } from "@/lib/utils";

/**
 * Names the portals this account can open and moves between them. Owners run
 * all three; anyone with a single portal has nothing to switch, so the whole
 * block disappears rather than showing a list of one.
 */
export function PortalSwitch({
  onNavigate,
  tone = "dark",
}: {
  onNavigate?: () => void;
  tone?: "dark" | "light";
}) {
  const pathname = usePathname();
  const { currentUser } = useOperations();
  const portals = currentUser
    ? availablePortals(currentUser.accessRole, effectivePermissions(currentUser))
    : [];
  if (portals.length < 2) return null;
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "px-3 text-[11px] font-semibold uppercase tracking-[0.18em]",
          tone === "dark" ? "text-brand-ice/55" : "text-brand-steel",
        )}
      >
        Portals
      </div>
      {portals.map((portal) => {
        const active = pathname.startsWith(portal.prefix);
        return (
          <Link
            key={portal.id}
            href={portal.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded px-3 py-2 font-heading text-sm font-medium uppercase tracking-wide",
              active && "bg-brand-blue text-white",
              !active && tone === "dark" && "text-brand-ice hover:bg-white/10",
              !active &&
                tone === "light" &&
                "text-brand-charcoal dark:text-gray-100",
            )}
          >
            <Icon name={portal.icon} width={18} height={18} />
            {portal.label}
          </Link>
        );
      })}
    </div>
  );
}
