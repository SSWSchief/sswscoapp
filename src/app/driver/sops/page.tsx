import { MobileHeader } from "@/components/driver/MobileHeader";
import { Badge } from "@/components/ui/StatusBadge";
import { getSopItems } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default function DriverSopsPage() {
  const items = getSopItems();

  return (
    <>
      <MobileHeader title="SOPs" menu />
      <div className="flex-1 overflow-y-auto bg-surface dark:bg-gray-950 p-4 space-y-3">
        {items.map((item) => {
          const acknowledged = item.acknowledgedBy.includes("u1");
          return (
            <div
              key={item.id}
              className="rounded-card bg-white dark:bg-gray-900 border border-brand-ice/70 dark:border-white/10 shadow-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-blue">
                    {item.category}
                  </div>
                  <h2 className="font-semibold text-brand-charcoal dark:text-white mt-1">
                    {item.title}
                  </h2>
                </div>
                <Badge tone={acknowledged ? "green" : "amber"} label={acknowledged ? "Reviewed" : "Review"} />
              </div>
              <p className="text-sm text-brand-steel dark:text-gray-400 mt-2">{item.summary}</p>
              <div className="text-xs text-brand-silver mt-3">Updated {formatDate(item.updatedAt)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
