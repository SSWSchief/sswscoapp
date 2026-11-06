import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A phone or email address, as something to tap only when there is one.
 *
 * Contact details are optional throughout: a customer booked from the job form
 * has a name and an address and nothing else until somebody fills the rest in.
 * Rendered without a guard, that produced `href="tel:"` — a link that looks
 * live, is styled like every other number on the screen, and does nothing when
 * a driver taps it in the cab. These render the fallback instead, so an absent
 * number reads as absent.
 */
function isBlank(value: string | null | undefined) {
  return !value || !value.trim();
}

function Missing({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("text-brand-silver", className)}>{label}</span>
  );
}

export function PhoneLink({
  phone,
  className,
  missingLabel = "No phone number",
  children,
}: {
  phone: string | null | undefined;
  className?: string;
  /** What stands in when there is no number. */
  missingLabel?: string;
  children?: React.ReactNode;
}) {
  if (isBlank(phone))
    return <Missing label={missingLabel} className={className} />;
  return (
    <a
      href={`tel:${(phone as string).replace(/[^\d+]/g, "")}`}
      className={className}
    >
      {children ?? phone}
    </a>
  );
}

export function EmailLink({
  email,
  className,
  missingLabel = "No email address",
  children,
}: {
  email: string | null | undefined;
  className?: string;
  missingLabel?: string;
  children?: React.ReactNode;
}) {
  if (isBlank(email))
    return <Missing label={missingLabel} className={className} />;
  return (
    <a href={`mailto:${email}`} className={className}>
      {children ?? email}
    </a>
  );
}

/** Whether a contact value is worth rendering as an action at all. */
export function hasContact(value: string | null | undefined) {
  return !isBlank(value);
}
