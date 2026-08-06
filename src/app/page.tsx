import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Public entry point; protected routes resolve authenticated users by role. */
export default function Home() {
  return (
    <main className="app-viewport-height safe-area-all flex flex-col items-center justify-start overflow-y-auto bg-brand-mist px-4 py-8 sm:justify-center">
      <p className="mb-2 font-heading text-3xl font-bold uppercase tracking-wide text-brand-navy">Silver State Waste Solutions</p>
      <p className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-steel mb-8">
        Overwatch · Operations Command Center
      </p>

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <Link
          href="/login"
          className="group rounded-card bg-white border border-brand-ice shadow-card p-6 hover:border-brand-blue hover:shadow-md transition"
        >
          <div className="h-11 w-11 rounded bg-brand-blue text-white flex items-center justify-center mb-4">
            <Icon name="dashboard" />
          </div>
          <div className="font-heading text-lg font-semibold uppercase tracking-wide text-brand-charcoal flex items-center gap-1.5">
            Dispatcher Portal
            <Icon
              name="chevron-right"
              width={16}
              height={16}
              className="text-brand-steel group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <p className="text-sm text-brand-steel mt-1">
            Manage Phase 1 dispatch, jobs, customers, assets, employees, and time review.
          </p>
        </Link>

        <Link
          href="/driver/jobs"
          className="group rounded-card bg-white border border-brand-ice shadow-card p-6 hover:border-brand-blue hover:shadow-md transition"
        >
          <div className="h-11 w-11 rounded bg-brand-navy text-white flex items-center justify-center mb-4">
            <Icon name="truck" />
          </div>
          <div className="font-heading text-lg font-semibold uppercase tracking-wide text-brand-charcoal flex items-center gap-1.5">
            Driver
            <Icon
              name="chevron-right"
              width={16}
              height={16}
              className="text-brand-steel group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <p className="text-sm text-brand-steel mt-1">
            Mobile work queue, job actions, photos, notes, and time clock.
          </p>
        </Link>

        <Link
          href="/management"
          className="group rounded-card bg-white border border-brand-ice shadow-card p-6 hover:border-brand-blue hover:shadow-md transition"
        >
          <div className="h-11 w-11 rounded bg-brand-charcoal text-white flex items-center justify-center mb-4">
            <Icon name="reports" />
          </div>
          <div className="font-heading text-lg font-semibold uppercase tracking-wide text-brand-charcoal flex items-center gap-1.5">
            Management
            <Icon
              name="chevron-right"
              width={16}
              height={16}
              className="text-brand-steel group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <p className="text-sm text-brand-steel mt-1">
            Management partner portal is visible as a future-phase preview.
          </p>
        </Link>
      </div>

      <p className="text-xs text-brand-steel mt-10 max-w-md text-center">
        Phase 1 pilot environment. Sign in with an authorized employee account;
        unavailable modules are clearly marked Coming Soon.
      </p>
    </main>
  );
}
