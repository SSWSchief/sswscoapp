import { avatarColor, cn } from "@/lib/utils";

export function Avatar({
  initials,
  size = "md",
  className,
  /** When false, uses the flat brand tint instead of a per-person color. */
  colorful = true,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  colorful?: boolean;
}) {
  const sizes = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
        colorful ? avatarColor(initials) : "bg-brand-50 text-brand-500",
        sizes[size],
        className
      )}
    >
      {initials}
    </span>
  );
}
