import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-white border border-brand-ice/60 shadow-card dark:border-white/10 dark:bg-gray-900",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-brand-ice/50 px-4 py-4 dark:border-white/10 sm:px-5",
        className,
      )}
    >
      <h2 className="min-w-0 font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">
        {title}
      </h2>
      {action}
    </div>
  );
}
