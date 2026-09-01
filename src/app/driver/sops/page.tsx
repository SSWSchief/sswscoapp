"use client";
import * as React from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { effectivePermissions } from "@/lib/permissions";
export default function Page() {
  const { sops, acknowledgeSop } = useExpandedOperations();
  const { currentUser } = useOperations();
  const { toast } = useToast();
  // This page reads SOPs; it never published them, and there was nothing here
  // to say where publishing lives. Anyone who can reach Settings gets pointed
  // at the tab that does it.
  const canPublish = currentUser
    ? effectivePermissions(currentUser).settings === true
    : false;
  const [openId, setOpenId] = React.useState<string | null>(null);
  const published = sops
    .filter((s) => s.isPublished)
    .sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged));
  return (
    <>
      <MobileHeader title="SOPs" />
      <div className="flex-1 space-y-3 overflow-y-auto bg-surface p-4">
        {published.map((s) => {
          const open = openId === s.id;
          return (
            <Card key={s.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                aria-expanded={open}
                className="flex min-h-14 w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-brand-blue">
                    {s.category} · v{s.version}
                  </div>
                  <h2 className="mt-1 truncate font-semibold">{s.title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={s.acknowledged ? "green" : "amber"}
                    label={s.acknowledged ? "Reviewed" : "Review"}
                  />
                  <Icon
                    name="chevron-down"
                    className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {open && (
                <div className="border-t border-brand-ice p-4 pt-3 dark:border-white/10">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-brand-steel">
                    {s.body}
                  </p>
                  {!s.acknowledged && (
                    <Button
                      className="mt-4 w-full"
                      onClick={async () => {
                        const r = await acknowledgeSop(s.id);
                        toast(r.ok ? "SOP acknowledged" : r.error.message, {
                          tone: r.ok ? "success" : "error",
                        });
                      }}
                    >
                      I Have Read This SOP
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {!published.length && (
          <Card className="p-6 text-center text-brand-steel">
            No published SOPs.
          </Card>
        )}
        {canPublish && (
          <Link
            href="/dispatcher/settings?tab=sops"
            className="flex min-h-14 items-center justify-center gap-2 rounded border border-dashed border-brand-ice px-4 text-center font-heading text-sm font-semibold uppercase tracking-wide text-brand-blue"
          >
            <Icon name="settings" width={18} height={18} />
            Publish or Update SOPs
          </Link>
        )}
      </div>
    </>
  );
}
