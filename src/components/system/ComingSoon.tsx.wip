import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { FeatureDefinition } from "@/lib/features";

export function ComingSoon({ feature, icon = "info" }: { feature:FeatureDefinition; icon?:IconName }) {
  return <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
    <Card className="w-full max-w-xl p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-mist text-brand-blue"><Icon name={icon} /></span>
      <span className="mt-5 inline-flex rounded-full bg-brand-ice px-3 py-1 font-heading text-xs font-semibold uppercase tracking-wide text-brand-navy">Future phase</span>
      <h2 className="mt-4 font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">{feature.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-steel">{feature.description}</p>
      <p className="mt-5 text-xs text-brand-silver">No data is being displayed or changed on this screen.</p>
    </Card>
  </div>;
}
