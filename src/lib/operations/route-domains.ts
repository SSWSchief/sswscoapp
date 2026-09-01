export type CoreDomain =
  | "jobs"
  | "notifications"
  | "people"
  | "customers"
  | "vendors"
  | "fleet"
  | "time";

export type ExpandedDomain =
  "finance" | "messaging" | "compliance" | "settings";

const allCore: CoreDomain[] = [
  "jobs",
  "notifications",
  "people",
  "customers",
  "vendors",
  "fleet",
  "time",
];

const allExpanded: ExpandedDomain[] = [
  "finance",
  "messaging",
  "compliance",
  "settings",
];

export function coreDomainsForPath(pathname: string): Set<CoreDomain> {
  const domains = new Set<CoreDomain>(["notifications"]);
  if (
    pathname === "/management" ||
    pathname === "/dispatcher/dashboard" ||
    pathname === "/dispatcher/reports"
  ) {
    return new Set(allCore);
  }
  if (
    pathname.startsWith("/dispatcher/jobs") ||
    pathname.startsWith("/driver/jobs")
  ) {
    ["jobs", "customers", "fleet", "people"].forEach((domain) =>
      domains.add(domain as CoreDomain),
    );
  }
  if (pathname.startsWith("/dispatcher/customers")) domains.add("customers");
  if (pathname.startsWith("/dispatcher/vendors")) domains.add("vendors");
  if (pathname.startsWith("/dispatcher/employees")) domains.add("people");
  if (pathname.startsWith("/dispatcher/invoices")) domains.add("customers");
  if (pathname.startsWith("/dispatcher/settings")) domains.add("people");
  if (pathname.startsWith("/dispatcher/trucks")) {
    domains.add("fleet");
    domains.add("jobs");
    domains.add("people");
  }
  if (
    pathname.startsWith("/dispatcher/dumpsters") ||
    pathname.startsWith("/driver/pre-trip")
  )
    domains.add("fleet");
  if (pathname.startsWith("/driver/profile")) domains.add("fleet");
  if (pathname.startsWith("/dispatcher/map")) {
    domains.add("jobs");
    domains.add("customers");
    domains.add("fleet");
  }
  if (pathname.includes("time-clock") || pathname.includes("absence-calendar"))
    ["time", "people"].forEach((domain) => domains.add(domain as CoreDomain));
  return domains;
}

export function expandedDomainsForPath(pathname: string): Set<ExpandedDomain> {
  if (pathname === "/management") return new Set(allExpanded);
  // Messaging stays loaded on every screen (like the "notifications" core
  // domain) so unread badges in the sidebar/nav and topbar stay live even
  // when the Messages page itself isn't open.
  const domains = new Set<ExpandedDomain>(["messaging"]);
  if (pathname === "/dispatcher/dashboard") {
    domains.add("finance");
    domains.add("compliance");
  }
  if (
    pathname.startsWith("/dispatcher/invoices") ||
    pathname.startsWith("/dispatcher/reports")
  )
    domains.add("finance");
  if (
    pathname.startsWith("/driver/pre-trip") ||
    pathname.startsWith("/driver/sops")
  )
    domains.add("compliance");
  if (pathname.startsWith("/dispatcher/settings")) {
    domains.add("compliance");
    domains.add("settings");
    // The pricing tab lives in Settings but its data belongs to finance.
    domains.add("finance");
  }
  if (pathname.startsWith("/driver/profile")) domains.add("settings");
  return domains;
}

export function detailJobId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:dispatcher|driver)\/jobs\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function detailEmployeeId(pathname: string): string | null {
  const match = pathname.match(/^\/dispatcher\/employees\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function detailTruckId(pathname: string): string | null {
  const match = pathname.match(/^\/dispatcher\/trucks\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export const coreTableDomain: Record<string, CoreDomain> = {
  jobs: "jobs",
  job_events: "jobs",
  job_activities: "jobs",
  job_notes: "jobs",
  job_photos: "jobs",
  disposal_tickets: "jobs",
  notifications: "notifications",
  users: "people",
  customers: "customers",
  vendors: "vendors",
  trucks: "fleet",
  dumpsters: "fleet",
  time_entries: "time",
  time_entry_corrections: "time",
  time_requests: "time",
  absence_events: "time",
};

export const expandedTableDomain: Record<string, ExpandedDomain> = {
  invoices: "finance",
  price_list: "finance",
  message_channels: "messaging",
  message_channel_members: "messaging",
  messages: "messaging",
  message_reads: "messaging",
  pretrip_templates: "compliance",
  pretrip_submissions: "compliance",
  sop_documents: "compliance",
  sop_acknowledgements: "compliance",
  company_settings: "settings",
};
