import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  getAbsenceEvents,
  getDashboardStats,
  getInvoices,
  getJobActivities,
  getTrucks,
} from "@/lib/data";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/dispatcher/dashboard", label: "Operations", icon: "dashboard" },
  { href: "/dispatcher/jobs", label: "Jobs", icon: "jobs" },
  { href: "/dispatcher/trucks", label: "Assets", icon: "truck" },
  { href: "/dispatcher/invoices", label: "Invoices", icon: "invoice" },
  { href: "/dispatcher/time-clock", label: "Time / PTO", icon: "clock" },
  { href: "/dispatcher/messages", label: "Messages", icon: "messages" },
  { href: "/dispatcher/reports", label: "Reports", icon: "reports" },
];

export default function ManagementPage() {
  const stats = getDashboardStats();
  const invoices = getInvoices();
  const openReceivables = invoices
    .filter((i) => !["paid", "closed"].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <main className="app-viewport-height safe-area-all bg-brand-mist">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <LogoFull />
          <div className="text-left sm:text-right">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal sm:text-3xl">
              Overwatch Management Portal
            </h1>
            <p className="text-sm text-brand-steel">Prototype access for partners and leadership.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Jobs Today" value={stats.totalToday} />
          <Metric label="Active Jobs" value={stats.inProgress} />
          <Metric label="Receivables" value={`$${openReceivables.toLocaleString()}`} />
          <Metric label="Trucks Tracked" value={getTrucks().length} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Management Access" />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded border border-brand-ice p-4 hover:border-brand-blue hover:bg-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-brand-blue text-white">
                    <Icon name={link.icon} />
                  </span>
                  <span className="font-heading font-semibold uppercase tracking-wide text-brand-charcoal">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Watchlist" />
            <div className="divide-y divide-brand-ice/50">
              {getJobActivities().slice(0, 3).map((activity) => (
                <div key={activity.id} className="p-4">
                  <div className="font-semibold text-brand-charcoal">{activity.actorName}</div>
                  <p className="text-sm text-brand-steel">{activity.body}</p>
                </div>
              ))}
              <div className="p-4">
                <div className="font-semibold text-brand-charcoal">Team Coverage</div>
                <p className="text-sm text-brand-steel">
                  {getAbsenceEvents().length} PTO or absence events need schedule awareness.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="font-heading text-4xl font-bold text-brand-charcoal">{value}</div>
      <div className="font-heading text-sm uppercase tracking-wide text-brand-steel">{label}</div>
    </Card>
  );
}
