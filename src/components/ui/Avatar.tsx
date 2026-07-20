import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-brand-50 text-brand-500 font-semibold shrink-0",
        sizes[size],
        className
      )}
    >
      {initials}
    </span>
  );
}
