import type { IconName } from "@/components/ui/Icon";

export const dispatcherNav: { href: string; label: string; icon: IconName }[] = [
  { href: "/dispatcher/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dispatcher/jobs", label: "Jobs", icon: "jobs" },
  { href: "/dispatcher/customers", label: "Customers", icon: "customers" },
  { href: "/dispatcher/trucks", label: "Trucks", icon: "truck" },
  { href: "/dispatcher/dumpsters", label: "Dumpsters", icon: "dumpster" },
  { href: "/dispatcher/employees", label: "Employees", icon: "employees" },
  { href: "/dispatcher/time-clock", label: "Time Clock", icon: "clock" },
  { href: "/dispatcher/map", label: "Map", icon: "map" },
  { href: "/dispatcher/reports", label: "Reports", icon: "reports" },
  { href: "/dispatcher/settings", label: "Settings", icon: "settings" },
];
