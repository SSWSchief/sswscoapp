import { cn } from "@/lib/utils";
import { Card } from "./Card";

/** The four KPI tiles on the dispatcher dashboard. */
export function StatCard({
  value,
  label,
  sublabel,
  tone = "default",
}: {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  tone?: "default" | "blue" | "green" | "amber";
}) {
  const valueTone = {
    default: "text-brand-charcoal",
    blue: "text-brand-blue",
    green: "text-status-complete",
    amber: "text-status-pending",
  }[tone];

  return (
    <Card className="p-5">
      <div
        className={cn(
          "font-heading text-4xl font-bold leading-none",
          valueTone,
        )}
      >
        {value}
      </div>
      <div className="mt-2 font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-brand-steel mt-0.5">{sublabel}</div>
      )}
    </Card>
  );
}
