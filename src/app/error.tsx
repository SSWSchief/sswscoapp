"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoFull } from "@/components/ui/Logo";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-mist">
      <div
        className="w-full max-w-md rounded-card border border-brand-ice bg-white p-6 text-center shadow-card"
        role="alert"
      >
        <LogoFull className="justify-center" />
        <Icon
          name="info"
          width={34}
          height={34}
          className="mx-auto mt-4 text-red-600"
        />
        <h1 className="mt-3 font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
          Something Went Wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-brand-steel">
          Your confirmed work remains stored. Retry this screen, or return home
          if the problem continues.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded border border-brand-blue px-3 text-sm font-semibold text-brand-blue"
          >
            Home
          </Link>
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </main>
  );
}
