import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LogoFull } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-mist">
      <div className="w-full max-w-md rounded-card border border-brand-ice bg-white p-6 text-center shadow-card">
        <LogoFull className="justify-center" />
        <Icon name="search" width={34} height={34} className="mx-auto mt-4 text-brand-steel" />
        <h1 className="mt-3 font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">Page Not Found</h1>
        <p className="mt-2 text-sm text-brand-steel">The link may be outdated or the record may no longer be available.</p>
        <Link href="/" className="mt-5 flex min-h-11 items-center justify-center rounded bg-brand-blue px-4 font-heading text-sm font-semibold uppercase tracking-wide text-white">Return Home</Link>
      </div>
    </main>
  );
}
