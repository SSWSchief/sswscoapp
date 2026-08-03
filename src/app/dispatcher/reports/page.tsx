import { Topbar } from "@/components/dispatcher/Topbar";
import { Icon, type IconName } from "@/components/ui/Icon";

// Screen 11 — Reports (basic report launcher; full analytics is a Phase 2 item).
const reports: {
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    icon: "jobs",
    title: "Jobs Report",
    description: "View job activity, status, and completion reports.",
  },
  {
    icon: "employees",
    title: "Employee Report",
    description: "View time clock, hours worked, and attendance.",
  },
  {
    icon: "truck",
    title: "Asset Utilization",
    description: "View truck and dumpster utilization and activity.",
  },
  {
    icon: "export",
    title: "Operations Export",
    description: "Export jobs, activity changes, and status history to CSV.",
  },
  {
    icon: "invoice",
    title: "Invoice Export",
    description: "Export receivables, closed invoices, and reminders to CSV.",
  },
  {
    icon: "clock",
    title: "Time & PTO Export",
    description: "Export time entries, edit requests, PTO, and absences.",
  },
];

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Reports" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2 max-w-3xl">
          {reports.map((r) => (
            <button key={r.title} className="min-h-11 rounded-card border border-brand-ice bg-white p-5 text-left shadow-card transition hover:border-brand-blue hover:shadow-md active:bg-brand-mist sm:p-6">
              <div className="h-11 w-11 rounded bg-brand-blue text-white flex items-center justify-center mb-4">
                <Icon name={r.icon} />
              </div>
              <div className="font-heading text-lg font-semibold uppercase tracking-wide text-brand-charcoal">
                {r.title}
              </div>
              <p className="text-sm text-brand-steel mt-1">{r.description}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
