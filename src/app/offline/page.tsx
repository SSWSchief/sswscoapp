import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

export default function OfflinePage() {
  return (
    <main className="app-viewport-height flex items-center justify-center bg-brand-mist p-4 safe-area-all">
      <div className="w-full max-w-md rounded-card border border-brand-ice bg-white p-6 text-center shadow-card">
        <LogoFull className="justify-center" />
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <Icon name="info" width={28} height={28} />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
          You&apos;re Offline
        </h1>
        <p className="mt-2 text-sm leading-6 text-brand-steel">
          Reconnect before submitting operational changes. Offline write syncing
          will be enabled after the secure backend is connected.
        </p>
        <Link
          href="/"
          className="mt-6 flex min-h-11 items-center justify-center rounded bg-brand-blue px-4 font-heading text-sm font-semibold uppercase tracking-wide text-white"
        >
          Try Again
        </Link>
      </div>
    </main>
  );
}
