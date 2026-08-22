"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";
import { useWebPush } from "@/lib/push/useWebPush";
import { cn } from "@/lib/utils";

const pushToggleLabel: Record<string, string> = {
  unsupported: "Install to your Home Screen to enable notifications",
  denied: "Notifications blocked — enable in browser settings",
  granted: "Push notifications on",
  default: "Get notified of new messages",
};

export function DispatcherAccount({
  onSignedOut,
  className,
}: {
  onSignedOut?: () => void;
  className?: string;
}) {
  const { currentUser } = useOperations();
  const { status: pushStatus, subscribe, unsubscribe } = useWebPush();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    onSignedOut?.();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left">
        <Avatar
          initials={currentUser?.initials ?? "--"}
          size="sm"
          colorful={false}
          className="bg-brand-blue/25 text-brand-ice"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {currentUser?.fullName ?? "Loading account"}
          </div>
          <div className="text-xs capitalize opacity-70">
            {currentUser?.accessRole ?? ""}
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="rounded p-1 hover:bg-white/10"
        >
          <Icon name="logout" width={16} height={16} className="opacity-70" />
        </button>
      </div>
      {/* Staff had no way to change their own password; drivers already do from
          Profile. Matters more now that accounts can start on a temporary one. */}
      <button
        type="button"
        onClick={() => router.push("/reset-password")}
        className="w-full rounded px-2 py-1.5 text-left text-xs opacity-70 hover:bg-white/10 hover:opacity-100"
      >
        Change password
      </button>
      <button
        type="button"
        disabled={pushStatus === "unsupported" || pushStatus === "denied"}
        onClick={() =>
          void (pushStatus === "granted" ? unsubscribe() : subscribe())
        }
        className="w-full rounded px-2 py-1.5 text-left text-xs opacity-70 hover:bg-white/10 hover:opacity-100 disabled:hover:bg-transparent"
      >
        {pushToggleLabel[pushStatus] ?? pushToggleLabel.default}
      </button>
    </div>
  );
}
