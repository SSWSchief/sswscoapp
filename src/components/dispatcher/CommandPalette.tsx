"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useOperations } from "@/components/system/OperationsProvider";
import { staffNavItems, type AppNavItem } from "@/components/navigation/routes";
import { effectivePermissions } from "@/lib/permissions";
import type { Customer,Dumpster,Job,Truck,User } from "@/lib/types";

interface Item {
  id: string;
  label: string;
  sub: string;
  icon: IconName;
  href: string;
  keywords: string;
}

function buildIndex(routes:AppNavItem[],jobs:Job[],customers:Customer[],trucks:Truck[],dumpsters:Dumpster[],users:User[]): Item[] {
  const nav: Item[] = routes.map((route) => ({
    id: `nav-${route.permission}`,
    label: route.label,
    sub: "Go to",
    icon: route.icon,
    href: route.href,
    keywords: route.keywords ?? "",
  }));
  const jobItems: Item[] = jobs.map((j) => {
    const c = customers.find((x) => x.id === j.customerId);
    return {
      id: `job-${j.id}`,
      label: `Job ${j.reference}`,
      sub: `${c?.name ?? ""} · ${j.address}`,
      icon: "jobs" as IconName,
      href: `/dispatcher/jobs/${j.id}`,
      keywords: `${c?.name ?? ""} ${j.address} ${j.reference}`,
    };
  });
  const custItems: Item[] = customers.map((c) => ({
    id: `cust-${c.id}`,
    label: c.name,
    sub: c.phone,
    icon: "customers",
    href: "/dispatcher/customers",
    keywords: `${c.email} ${c.address}`,
  }));
  const truckItems: Item[] = trucks.map((t) => ({
    id: `truck-${t.id}`,
    label: t.number,
    sub: `Truck · ${t.licensePlate}`,
    icon: "truck",
    href: "/dispatcher/trucks",
    keywords: t.licensePlate,
  }));
  const dumpItems: Item[] = dumpsters.map((d) => ({
    id: `dump-${d.id}`,
    label: d.code,
    sub: `Dumpster · ${d.size}`,
    icon: "dumpster",
    href: "/dispatcher/dumpsters",
    keywords: `${d.airTagId ?? ""} ${d.currentLocation}`,
  }));
  const empItems: Item[] = users.map((u) => ({
    id: `emp-${u.id}`,
    label: u.fullName,
    sub: `${u.role} · ${u.phone}`,
    icon: "employees",
    href: "/dispatcher/employees",
    keywords: u.email,
  }));
  const allowed = new Set(routes.map((route) => route.permission));
  return [
    ...nav,
    ...(allowed.has("jobs") ? jobItems : []),
    ...(allowed.has("customers") ? custItems : []),
    ...(allowed.has("trucks") ? truckItems : []),
    ...(allowed.has("dumpsters") ? dumpItems : []),
    ...(allowed.has("employees") ? empItems : []),
  ];
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const {jobs,customers,trucks,dumpsters,users,currentUser}=useOperations();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const routes = React.useMemo(() => {
    if (!currentUser) return [];
    const permissions = effectivePermissions(currentUser);
    return staffNavItems.filter((route) => permissions[route.permission]);
  }, [currentUser]);
  const index = React.useMemo(()=>buildIndex(routes,jobs,customers,trucks,dumpsters,users), [routes,jobs,customers,trucks,dumpsters,users]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 8);
    return index
      .filter((i) =>
        `${i.label} ${i.sub} ${i.keywords}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, index]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  React.useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = (item: Item) => {
    router.push(item.href);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-brand-navy/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-lg rounded-card bg-white shadow-2xl overflow-hidden border border-brand-ice"
      >
        <div className="flex items-center gap-3 px-4 border-b border-brand-ice/60">
          <Icon name="search" className="text-brand-steel" width={18} height={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search jobs, customers, trucks, dumpsters…"
            className="flex-1 h-14 bg-transparent text-sm text-brand-charcoal outline-none placeholder:text-brand-silver"
          />
          <kbd className="hidden sm:block text-[11px] text-brand-steel border border-brand-ice rounded-sm px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-brand-steel">
              No results for “{query}”
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                  i === active ? "bg-brand-mist" : "hover:bg-brand-mist/70"
                )}
              >
                <span className="h-8 w-8 rounded bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                  <Icon name={item.icon} width={16} height={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-brand-charcoal truncate">
                    {item.label}
                  </span>
                  <span className="block text-xs text-brand-steel truncate">
                    {item.sub}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
