import type { IconName } from "@/components/ui/Icon";
import type { PermissionKey } from "@/lib/types";

export const dispatcherNav: { href: string; label: string; icon: IconName; permission: PermissionKey }[] = [
  { href: "/dispatcher/dashboard", label: "Dashboard", icon: "dashboard", permission: "dashboard" },
  { href: "/dispatcher/jobs", label: "Jobs", icon: "jobs", permission: "jobs" },
  { href: "/dispatcher/customers", label: "Customers", icon: "customers", permission: "customers" },
  { href: "/dispatcher/trucks", label: "Trucks", icon: "truck", permission: "trucks" },
  { href: "/dispatcher/dumpsters", label: "Dumpsters", icon: "dumpster", permission: "dumpsters" },
  { href: "/dispatcher/employees", label: "Employees", icon: "employees", permission: "employees" },
  { href: "/dispatcher/time-clock", label: "Time Clock", icon: "clock", permission: "time_clock" },
  { href: "/dispatcher/absence-calendar", label: "Absence", icon: "calendar", permission: "absence" },
  { href: "/dispatcher/invoices", label: "Invoices", icon: "invoice", permission: "invoices" },
  { href: "/dispatcher/messages", label: "Messages", icon: "messages", permission: "messages" },
  { href: "/dispatcher/map", label: "Map", icon: "map", permission: "map" },
  { href: "/dispatcher/reports", label: "Reports", icon: "reports", permission: "reports" },
  { href: "/dispatcher/settings", label: "Settings", icon: "settings", permission: "settings" },
];
