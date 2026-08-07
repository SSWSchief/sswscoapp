"use client";

import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useDriverTheme } from "@/components/driver/driver-context";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { InstallAppCard } from "@/components/system/InstallAppCard";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";

// Screen 18 — Profile (driver).
const items: { icon: IconName; label: string }[] = [
  { icon: "user", label: "Edit Profile" },
  { icon: "settings", label: "Change Password" },
  { icon: "bell", label: "Notification Settings" },
  { icon: "info", label: "Help & Support" },
];

export default function DriverProfilePage() {
  const { currentUser: driver } = useOperations();
  const { dark, toggle } = useDriverTheme();
  const confirm = useConfirm();
  const router = useRouter();

  const logout = async () => {
    const ok = await confirm({
      title: "Log out?",
      message: "You'll need to sign in again to see your jobs.",
      confirmLabel: "Log Out",
      tone: "danger",
    });
    if (ok) {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <>
      <MobileHeader title="Profile" menu />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-6 flex items-center gap-4 border-b border-brand-ice/60 dark:border-white/10">
          <Avatar initials={driver?.initials ?? "--"} size="lg" />
          <div>
            <div className="font-heading font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white text-lg">
              {driver?.fullName ?? "Employee"}
            </div>
            <div className="text-sm text-brand-steel dark:text-gray-400">Driver</div>
          </div>
        </div>

        <InstallAppCard />

        {/* Night mode */}
        <div className="bg-white dark:bg-gray-900 mt-3 border-y border-brand-ice/60 dark:border-white/10">
          <div className="flex items-center gap-3 px-5 py-4">
            <Icon
              name="settings"
              width={20}
              height={20}
              className="text-brand-steel dark:text-gray-400"
            />
            <span className="text-sm font-medium text-brand-charcoal dark:text-gray-100 flex-1">
              Night Mode
            </span>
            <button
              role="switch"
              aria-checked={dark}
              onClick={toggle}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                dark ? "bg-brand-blue" : "bg-brand-silver"
              }`}
              aria-label="Toggle night mode"
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  dark ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 mt-3 border-y border-brand-ice/60 dark:border-white/10 divide-y divide-brand-ice/60 dark:divide-white/10">
          {items.map((it) => (
            <button
              key={it.label}
              className="w-full flex items-center gap-3 px-5 py-4 active:bg-brand-mist dark:active:bg-white/5"
            >
              <Icon
                name={it.icon}
                width={20}
                height={20}
                className="text-brand-steel dark:text-gray-400"
              />
              <span className="text-sm font-medium text-brand-charcoal dark:text-gray-100 flex-1 text-left">
                {it.label}
              </span>
              <Icon
                name="chevron-right"
                width={18}
                height={18}
                className="text-brand-silver dark:text-gray-600"
              />
            </button>
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-5 py-4 active:bg-brand-mist dark:active:bg-white/5"
          >
            <Icon name="logout" width={20} height={20} className="text-red-500" />
            <span className="text-sm font-medium text-red-500 flex-1 text-left">
              Log Out
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-brand-steel py-6">
          SSWSCO Overwatch · Production Operations
        </p>
      </div>
    </>
  );
}
