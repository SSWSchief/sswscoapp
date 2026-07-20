import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";
type Size = "sm" | "md";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-[#003a86] focus-visible:ring-brand",
  secondary:
    "bg-white text-brand border border-brand/30 hover:bg-brand-50 focus-visible:ring-brand",
  danger: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
  success:
    "bg-status-complete text-white hover:bg-[#1aa94f] focus-visible:ring-status-complete",
  ghost: "text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
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
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
