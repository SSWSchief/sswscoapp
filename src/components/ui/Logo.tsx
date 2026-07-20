import { cn } from "@/lib/utils";

/**
 * Placeholder brand mark for Silver State Waste Solutions.
 * A roll-off truck glyph + wordmark. Swap for the client's real logo asset
 * once provided (no client assets are used in the skeleton).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      className={cn("shrink-0", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 22h22l6-9h9l5 6v3h3"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 22V9h14v13"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="25" r="3.5" stroke="currentColor" strokeWidth={2.5} />
      <circle cx="36" cy="25" r="3.5" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  );
}

export function LogoFull({
  className,
  dark,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-7 w-11", dark ? "text-white" : "text-brand")} />
      <div className="leading-tight">
        <div
          className={cn(
            "text-sm font-bold tracking-tight",
            dark ? "text-white" : "text-gray-900"
          )}
        >
          SILVER STATE
        </div>
        <div
          className={cn(
            "text-[10px] font-medium tracking-[0.2em]",
            dark ? "text-white/60" : "text-gray-400"
          )}
        >
          WASTE SOLUTIONS
        </div>
      </div>
    </div>
  );
}
