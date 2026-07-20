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
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface px-6">
      <LogoFull className="mb-2" />
      <p className="text-sm text-gray-500 mb-8">
        Internal Operations Platform · Phase 1 MVP
      </p>

      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
        <Link
          href="/login"
          className="group rounded-card bg-white border border-gray-200 shadow-card p-6 hover:border-brand hover:shadow-md transition"
        >
          <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
            <Icon name="dashboard" />
          </div>
          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
            Dispatcher
            <Icon
              name="chevron-right"
              width={16}
              height={16}
              className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Desktop dashboard — manage jobs, assets, and employees.
          </p>
        </Link>

        <Link
          href="/driver/jobs"
          className="group rounded-card bg-white border border-gray-200 shadow-card p-6 hover:border-brand hover:shadow-md transition"
        >
          <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
            <Icon name="truck" />
          </div>
          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
            Driver
            <Icon
              name="chevron-right"
              width={16}
              height={16}
              className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Mobile view — assigned jobs, navigation, time clock.
          </p>
        </Link>
      </div>

      <p className="text-xs text-gray-400 mt-10 max-w-md text-center">
        Design skeleton. Screens render from mock data — no backend is connected
        yet.
      </p>
    </main>
  );
}
