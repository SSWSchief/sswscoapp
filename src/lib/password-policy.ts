/**
 * One definition of what counts as an acceptable password.
 *
 * Passwords are the only authentication factor in this system — administrator
 * MFA is disabled under an accepted-risk policy — so "strong unique passwords"
 * is the compensating control the handoff documentation leans on. It should
 * therefore mean something specific rather than being a length check.
 *
 * This mirrors `password_requirements = "lower_upper_letters_digits"` and
 * `minimum_password_length = 12` from `supabase/config.toml`. That file governs
 * only local development and never reaches a hosted project, so treat it as the
 * statement of intent and this module as the enforcement.
 *
 * Deliberately importable from the browser: the reset screen needs it, and the
 * temporary-password generator needs to produce values that satisfy it.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

export const passwordPolicyHint =
  "Use at least 12 characters, with an uppercase letter, a lowercase letter, and a number.";

interface PasswordRule {
  readonly test: (password: string) => boolean;
  readonly problem: string;
}

const rules: readonly PasswordRule[] = [
  {
    test: (password) => password.length >= MINIMUM_PASSWORD_LENGTH,
    problem: `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  },
  {
    test: (password) => /[a-z]/.test(password),
    problem: "Include a lowercase letter.",
  },
  {
    test: (password) => /[A-Z]/.test(password),
    problem: "Include an uppercase letter.",
  },
  { test: (password) => /[0-9]/.test(password), problem: "Include a number." },
];

/**
 * The first unmet requirement, or null when the password is acceptable.
 *
 * Returns one problem rather than all of them so the form can say the single
 * next thing to fix instead of listing every failure at someone mid-typing.
 */
export function passwordProblem(password: string): string | null {
  return rules.find((rule) => !rule.test(password))?.problem ?? null;
}

export function satisfiesPasswordPolicy(password: string): boolean {
  return passwordProblem(password) === null;
}
