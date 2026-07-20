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
    default: "text-gray-900",
    blue: "text-brand-500",
    green: "text-status-complete",
    amber: "text-status-pending",
  }[tone];

  return (
    <Card className="p-5">
      <div className={cn("text-3xl font-bold leading-none", valueTone)}>
        {value}
      </div>
      <div className="mt-2 text-sm font-medium text-gray-700">{label}</div>
      {sublabel && (
        <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>
      )}
    </Card>
  );
}
