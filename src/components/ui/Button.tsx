import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-blue text-white hover:bg-brand-navy focus-visible:ring-brand-blue",
  secondary:
    "bg-white text-brand-blue border border-brand-blue/40 hover:bg-brand-mist focus-visible:ring-brand-blue",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
  success:
    "bg-status-complete text-white hover:bg-emerald-800 focus-visible:ring-status-complete",
  ghost: "text-brand-steel hover:bg-brand-mist focus-visible:ring-brand-ice",
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 text-sm gap-1.5",
  md: "min-h-11 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded font-heading font-semibold uppercase tracking-wide transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "active:translate-y-px",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
