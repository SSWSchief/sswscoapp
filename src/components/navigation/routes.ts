import type { IconName } from "@/components/ui/Icon";
import type { PermissionKey } from "@/lib/types";

export interface AppNavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: IconName;
  permission: PermissionKey;
  keywords?: string;
}

export interface AppNavSection {
  label: string;
  items: AppNavItem[];
}

export const staffNavSections: AppNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/dispatcher/dashboard", label: "Operations Overview", shortLabel: "Overview", icon: "dashboard", permission: "dashboard", keywords: "home dashboard" },
      { href: "/dispatcher/jobs", label: "Jobs", icon: "jobs", permission: "jobs" },
      { href: "/dispatcher/map", label: "Locations", icon: "map", permission: "map", keywords: "map airtags assets" },
      { href: "/dispatcher/messages", label: "Messages", icon: "messages", permission: "messages", keywords: "chat announcements direct" },
    ],
  },
  {
    label: "Customers & Fleet",
    items: [
      { href: "/dispatcher/customers", label: "Customers", icon: "customers", permission: "customers" },
      { href: "/dispatcher/trucks", label: "Trucks", icon: "truck", permission: "trucks", keywords: "fleet assets" },
      { href: "/dispatcher/dumpsters", label: "Dumpsters", icon: "dumpster", permission: "dumpsters", keywords: "containers assets" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/dispatcher/employees", label: "Employees", icon: "employees", permission: "employees", keywords: "drivers staff access" },
      { href: "/dispatcher/time-clock", label: "Time Clock", icon: "clock", permission: "time_clock", keywords: "pto attendance requests" },
      { href: "/dispatcher/absence-calendar", label: "Absence", icon: "calendar", permission: "absence", keywords: "calendar pto leave" },
    ],
  },
  {
    label: "Finance & Reporting",
    items: [
      { href: "/dispatcher/invoices", label: "Invoices", icon: "invoice", permission: "invoices", keywords: "billing receivables" },
      { href: "/dispatcher/reports", label: "Reports", icon: "reports", permission: "reports", keywords: "exports csv" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/management", label: "Management Overview", icon: "dashboard", permission: "management", keywords: "admin leadership oversight" },
      { href: "/dispatcher/settings", label: "Settings", icon: "settings", permission: "settings", keywords: "company roles sop pretrip" },
    ],
  },
];

export const staffNavItems = staffNavSections.flatMap((section) => section.items);
export const staffMobileNav = staffNavSections[0].items;

export const driverPrimaryNav: AppNavItem[] = [
  { href: "/driver/jobs", label: "My Jobs", icon: "dashboard", permission: "driver_jobs", keywords: "home assigned work" },
  { href: "/driver/time-clock", label: "Time", icon: "clock", permission: "time_clock", keywords: "time clock" },
  { href: "/driver/pre-trip", label: "Pre-Trip", icon: "clipboard", permission: "pre_trip", keywords: "inspection truck" },
  { href: "/driver/messages", label: "Messages", icon: "messages", permission: "messages" },
];

export const driverSecondaryNav: AppNavItem[] = [
  { href: "/driver/sops", label: "SOPs", icon: "jobs", permission: "sops", keywords: "procedures safety" },
  { href: "/driver/profile", label: "Profile", icon: "user", permission: "profile", keywords: "account install help" },
];
