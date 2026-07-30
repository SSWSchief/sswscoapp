import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

/**
 * Skeleton landing / role picker. In production the root route resolves to the
 * signed-in user's role automatically; here it lets a reviewer jump into either
 * experience during the walkthrough.
 */
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-brand-mist px-6">
      <LogoFull className="mb-2" />
      <p className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-steel mb-8">
        Overwatch · Operations Command Center
      </p>

      <div className="grid gap-4 sm:grid-cols-3 w-full max-w-4xl">
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
            Manage jobs, assets, invoices, messages, and team coverage.
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
            Mobile work queue, job actions, SOPs, and time clock.
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
            Partner access for operations, receivables, exports, and coverage.
          </p>
        </Link>
      </div>

      <p className="text-xs text-brand-steel mt-10 max-w-md text-center">
        Overwatch prototype. Screens render from mock data while backend,
        payment, and GPS integrations are scoped.
      </p>
    </main>
  );
}
