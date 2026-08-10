import { LogoMark } from "@/components/ui/Logo";

export default function Loading() {
  return (
    <main
      className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-mist"
      role="status"
      aria-label="Loading Overwatch"
    >
      <div className="text-center">
        <LogoMark className="mx-auto h-20 w-32 animate-pulse" />
        <p className="mt-3 font-heading text-sm font-semibold uppercase tracking-wide text-brand-steel">
          Loading Overwatch…
        </p>
      </div>
    </main>
  );
}
