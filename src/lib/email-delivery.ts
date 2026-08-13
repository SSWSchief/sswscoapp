/**
 * Whether the project can actually deliver transactional email.
 *
 * Supabase sends invitation and password-recovery mail only once custom SMTP is
 * configured. Until then `resetPasswordForEmail` still resolves successfully —
 * it simply produces a message nobody receives — so the sign-in screen would
 * otherwise promise an email that never arrives and leave the employee waiting.
 * Onboarding runs on administrator-issued temporary passwords instead.
 *
 * Flip `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED` to `true` once SMTP is connected;
 * no code change is needed. Defaults to off so a project that has not been
 * configured tells the truth rather than the flattering thing.
 */
export function emailDeliveryEnabled() {
  // Next.js only inlines browser-safe variables referenced statically, matching
  // the constraint documented in `src/lib/supabase/env.ts`.
  return process.env.NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED === "true";
}

/** What to tell someone who cannot sign in, given the delivery state. */
export function passwordRecoveryGuidance(enabled = emailDeliveryEnabled()) {
  return enabled
    ? "Password reset instructions were sent if that account exists."
    : "Ask an administrator to issue you a new temporary password.";
}
