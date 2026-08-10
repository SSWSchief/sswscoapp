"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function DispatcherAccount({
  onSignedOut,
  className,
}: {
  onSignedOut?: () => void;
  className?: string;
}) {
  const { currentUser } = useOperations();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    onSignedOut?.();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      className={cn(
        "flex w-full items-center gap-2.5 rounded px-2 py-2 text-left hover:bg-white/10",
        className,
      )}
    >
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
      <Icon name="logout" width={16} height={16} className="opacity-70" />
    </button>
  );
}
