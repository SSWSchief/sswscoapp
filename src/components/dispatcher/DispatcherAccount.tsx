"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { useWebPush } from "@/lib/push/useWebPush";
import { cn } from "@/lib/utils";

const pushToggleLabel: Record<string, string> = {
  unsupported: "Add to Home Screen first",
  unconfigured: "Unavailable on this deployment",
  denied: "Blocked in phone settings",
  granted: "On",
  default: "Off — tap to turn on",
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
  const { toast } = useToast();
  const router = useRouter();

  const togglePush = async () => {
    const result =
      pushStatus === "granted" ? await unsubscribe() : await subscribe();
    if (result.ok) {
      toast(
        pushStatus === "granted"
          ? "Push alerts turned off."
          : "Push alerts are on for this device.",
        { tone: "success" },
      );
      return;
    }
    toast(result.message ?? "Could not change notification settings.", {
      tone: "error",
    });
  };

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
          src={currentUser?.avatarUrl}
          alt={currentUser?.fullName}
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
      {/* Was a line of grey 12px text that read as a caption, so nobody
          realised it was the control — and a failed tap said nothing at all. */}
      <button
        type="button"
        disabled={
          pushStatus === "loading" ||
          pushStatus === "unsupported" ||
          pushStatus === "unconfigured" ||
          pushStatus === "denied"
        }
        aria-pressed={pushStatus === "granted"}
        onClick={() => void togglePush()}
        className="mt-1 flex w-full items-center gap-2.5 rounded border border-white/15 bg-white/5 px-2.5 py-2 text-left hover:bg-white/10 disabled:opacity-60 disabled:hover:bg-white/5"
      >
        <Icon name="bell" width={16} height={16} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">Push alerts</span>
          <span className="block truncate text-[11px] opacity-70">
            {pushToggleLabel[pushStatus] ?? pushToggleLabel.default}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors",
            pushStatus === "granted" ? "bg-emerald-400" : "bg-white/25",
          )}
        >
          <span
            className={cn(
              "block h-3 w-3 rounded-full bg-white transition-transform",
              pushStatus === "granted" && "translate-x-3",
            )}
          />
        </span>
      </button>
    </div>
  );
}
