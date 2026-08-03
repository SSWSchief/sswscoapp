import Link from "next/link";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Icon } from "@/components/ui/Icon";

export default function PreTripPlaceholderPage() {
  return (
    <>
      <MobileHeader title="Electronic Pre-Trip" menu />
      <div className="flex-1 overflow-y-auto bg-surface p-4 dark:bg-gray-950">
        <div className="rounded-card border border-brand-ice bg-white p-6 text-center shadow-card dark:border-white/10 dark:bg-gray-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
            <Icon name="clipboard" width={28} height={28} />
          </span>
          <h2 className="mt-4 font-heading text-xl font-bold uppercase tracking-wide text-brand-charcoal dark:text-white">
            Electronic Pre-Trip
          </h2>
          <p className="mt-3 text-sm leading-6 text-brand-steel dark:text-gray-400">
            This portal entry is ready. The inspection fields and submission workflow will be built from Silver State Waste Solutions&apos; existing pre-trip form once it is provided.
          </p>
          <div className="mt-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            Mileage remains manual demo data until the approved pre-trip form and Supabase storage are connected.
          </div>
          <Link href="/driver/jobs" className="mt-6 flex h-12 items-center justify-center gap-2 rounded bg-brand-blue font-heading text-sm font-semibold uppercase tracking-wide text-white">
            <Icon name="dashboard" width={18} height={18} /> Return Home
          </Link>
        </div>
      </div>
    </>
  );
}
