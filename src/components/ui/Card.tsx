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
        "rounded-card bg-white border border-brand-ice/60 shadow-card",
        className
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
        "flex items-center justify-between px-5 py-4 border-b border-brand-ice/50",
        className
      )}
    >
      <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
        {title}
      </h2>
      {action}
    </div>
  );
}
