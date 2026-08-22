"use client";

import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useDriverTheme } from "@/components/driver/driver-context";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { InstallAppCard } from "@/components/system/InstallAppCard";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";
import { useWebPush } from "@/lib/push/useWebPush";

// Screen 18 — Profile (driver).
const items: {
  icon: IconName;
  label: string;
  action: "profile" | "password" | "support";
}[] = [
  { icon: "user", label: "Edit Profile", action: "profile" },
  { icon: "settings", label: "Change Password", action: "password" },
  { icon: "info", label: "Help & Support", action: "support" },
];

export default function DriverProfilePage() {
  const { currentUser: driver, trucks } = useOperations();
  const { settings } = useExpandedOperations();
  const { dark, toggle } = useDriverTheme();
  const { status: pushStatus, subscribe, unsubscribe } = useWebPush();
  const confirm = useConfirm();
  const router = useRouter();
  const supportEmail = settings?.email ?? "dispatch@sswsco.com";
  const assignedTruck = trucks.find(
    (truck) => truck.assignedDriverId === driver?.id,
  );

  const emailSupport = (subject: string, body: string) => {
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const runProfileAction = (action: (typeof items)[number]["action"]) => {
    if (action === "password") {
      router.push("/reset-password");
      return;
    }
    if (action === "profile") {
      emailSupport(
        "Driver profile update request",
        `Please update my SSWSCO Overwatch profile.\n\nName: ${driver?.fullName ?? ""}\nEmployee ID: ${driver?.employeeId ?? ""}\nPhone/email changes requested:\n`,
      );
      return;
    }
    emailSupport(
      "SSWSCO Overwatch support request",
      `I need help with SSWSCO Overwatch.\n\nName: ${driver?.fullName ?? ""}\nEmployee ID: ${driver?.employeeId ?? ""}\nIssue:\n`,
    );
  };

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
      <MobileHeader title="Profile" />

      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-6 flex items-center gap-4 border-b border-brand-ice/60 dark:border-white/10">
          <Avatar initials={driver?.initials ?? "--"} size="lg" />
          <div>
            <div className="font-heading font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white text-lg">
              {driver?.fullName ?? "Employee"}
            </div>
            <div className="text-sm text-brand-steel dark:text-gray-400">
              Driver
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-charcoal dark:text-gray-200">
              <Icon name="truck" width={16} height={16} />
              {assignedTruck
                ? `Assigned truck: ${assignedTruck.number}`
                : "No truck assigned"}
            </div>
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

        {/* Push notifications */}
        <div className="bg-white dark:bg-gray-900 mt-3 border-y border-brand-ice/60 dark:border-white/10">
          <div className="flex items-center gap-3 px-5 py-4">
            <Icon
              name="bell"
              width={20}
              height={20}
              className="text-brand-steel dark:text-gray-400"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-brand-charcoal dark:text-gray-100">
                Push Notifications
              </span>
              {pushStatus === "unsupported" && (
                <p className="mt-0.5 text-xs text-brand-steel dark:text-gray-400">
                  Install to your Home Screen to enable notifications.
                </p>
              )}
              {pushStatus === "denied" && (
                <p className="mt-0.5 text-xs text-brand-steel dark:text-gray-400">
                  Blocked — enable in your browser or device settings.
                </p>
              )}
            </div>
            {pushStatus !== "unsupported" && pushStatus !== "loading" && (
              <button
                role="switch"
                aria-checked={pushStatus === "granted"}
                disabled={pushStatus === "denied"}
                onClick={() =>
                  void (pushStatus === "granted" ? unsubscribe() : subscribe())
                }
                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
                  pushStatus === "granted" ? "bg-brand-blue" : "bg-brand-silver"
                }`}
                aria-label="Toggle push notifications"
              >
                <span
                  className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    pushStatus === "granted" ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 mt-3 border-y border-brand-ice/60 dark:border-white/10 divide-y divide-brand-ice/60 dark:divide-white/10">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => runProfileAction(it.action)}
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
            <Icon
              name="logout"
              width={20}
              height={20}
              className="text-red-500"
            />
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
