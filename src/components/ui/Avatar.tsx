"use client";

import * as React from "react";
import { avatarColor, cn } from "@/lib/utils";

const sizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({
  initials,
  src,
  alt,
  size = "md",
  className,
  /** When false, uses the flat brand tint instead of a per-person color. */
  colorful = true,
}: {
  initials: string;
  /**
   * Signed URL for the employee's photo, when they have one. Signed URLs
   * expire, so a failed load falls back to initials rather than leaving a
   * broken image where a face should be.
   */
  src?: string | null;
  alt?: string;
  size?: keyof typeof sizes;
  className?: string;
  colorful?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  // A new URL for the same person deserves a fresh attempt — otherwise one
  // expired signature would hide their photo for the rest of the session.
  React.useEffect(() => setFailed(false), [src]);

  if (src && !failed)
    return (
      // Signed Supabase URLs are short-lived and per-viewer, which the image
      // optimizer cannot cache usefully — and an avatar is already the size
      // the optimizer would be resizing it to.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? initials}
        onError={() => setFailed(true)}
        className={cn(
          "inline-block shrink-0 rounded-full object-cover",
          sizes[size],
          className,
        )}
      />
    );

  return (
    <span
      aria-label={alt}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-heading font-semibold shrink-0",
        colorful ? avatarColor(initials) : "bg-brand-blue/15 text-brand-ice",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
