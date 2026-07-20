import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CURRENT_DRIVER_ID, getUser } from "@/lib/data";

// Screen 18 — Profile (driver).
const items: { icon: IconName; label: string; danger?: boolean }[] = [
  { icon: "user", label: "Edit Profile" },
  { icon: "settings", label: "Change Password" },
  { icon: "bell", label: "Notification Settings" },
  { icon: "info", label: "Help & Support" },
  { icon: "logout", label: "Log Out", danger: true },
];

export default function DriverProfilePage() {
  const driver = getUser(CURRENT_DRIVER_ID)!;

  return (
    <>
      <MobileHeader title="Profile" menu />

      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="bg-white p-6 flex items-center gap-4 border-b border-gray-100">
          <Avatar initials={driver.initials} size="lg" />
          <div>
            <div className="font-semibold text-gray-900 text-lg">
              {driver.fullName}
            </div>
            <div className="text-sm text-gray-500">Driver</div>
          </div>
        </div>

        <div className="bg-white mt-3 border-y border-gray-100 divide-y divide-gray-100">
          {items.map((it) => (
            <Link
              key={it.label}
              href="#"
              className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50"
            >
              <Icon
                name={it.icon}
                width={20}
                height={20}
                className={it.danger ? "text-red-500" : "text-gray-500"}
              />
              <span
                className={
                  it.danger
                    ? "text-sm font-medium text-red-500 flex-1"
                    : "text-sm font-medium text-gray-800 flex-1"
                }
              >
                {it.label}
              </span>
              {!it.danger && (
                <Icon
                  name="chevron-right"
                  width={18}
                  height={18}
                  className="text-gray-300"
                />
              )}
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 py-6">
          SSWS Operations · Phase 1 MVP
        </p>
      </div>
    </>
  );
}
