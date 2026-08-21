/**
 * The one public address emailed links are allowed to point at.
 *
 * Every invitation and password-reset link Supabase sends resolves its host
 * from one of three places, and two of them have already failed in production:
 *
 * - `redirect_to`, when the application supplies one and it is on the project's
 *   redirect allowlist. Supabase silently discards a `redirect_to` that is not.
 * - `{{ .SiteURL }}`, when the email template interpolates it.
 * - the Site URL again, as the fallback whenever `redirect_to` is absent or
 *   rejected.
 *
 * On August 20, 2026 the project's Site URL was
 * `https://sswscoapp-silver-state-waste-solutions.vercel.app` — the team-scoped
 * Vercel alias, which Deployment Protection answers with a `vercel.com/sso-api`
 * redirect. Every new hire who clicked "accept your invitation" was asked to
 * sign up for a Vercel account. `inviteUserByEmail` was passing no `redirectTo`
 * at all, so the Site URL was the *only* thing deciding where invitations
 * landed, and a dashboard field nobody deploys became load-bearing.
 *
 * So the address is resolved here, once, and never from the incoming request.
 * `request.url` reflects whichever host the administrator happened to be
 * browsing — including the protected alias — which reintroduces the same bug
 * from a different direction.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_APP_URL` — the authoritative setting. Set this.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's own production domain for the
 *      project. Correct by construction and needs no configuration, but it is
 *      only present when "Automatically expose System Environment Variables"
 *      is on, so it is a fallback rather than the answer.
 *   3. `http://localhost:3000` for local development.
 *
 * A deployment-specific alias is never one of these. `VERCEL_URL` is
 * deliberately not consulted: it names the individual deployment, which is
 * exactly the protected kind of host that started this.
 */

type AppUrlSource = "configured" | "vercel" | "development";

type ResolvedAppUrl = {
  /** Origin only, no trailing slash. */
  url: string;
  source: AppUrlSource;
};

function normalise(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

/**
 * Resolves the public application origin, preferring explicit configuration.
 *
 * Never throws: it is called while rendering pages that Next prerenders at
 * build time, where a missing Vercel variable is normal and must not fail the
 * build. Call {@link requireAppUrl} on the paths that actually send mail.
 */
export function resolveAppUrl(): ResolvedAppUrl {
  // Referenced statically so Next inlines it into the browser bundle; dynamic
  // `process.env[name]` access is undefined there, as `supabase/env.ts` notes.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return { url: normalise(configured), source: "configured" };
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return { url: normalise(vercel), source: "vercel" };
  return { url: "http://localhost:3000", source: "development" };
}

/**
 * The application origin, refusing the development fallback in production.
 *
 * A link to `http://localhost:3000` in a real invitation is unrecoverable for
 * the recipient, so the send is refused instead — the administrator gets an
 * error they can act on rather than an employee who cannot get in.
 */
export function requireAppUrl(): string {
  const resolved = resolveAppUrl();
  if (resolved.source === "development" && process.env.NODE_ENV === "production")
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set, so emailed links have no public address to point at.",
    );
  return resolved.url;
}

/**
 * The `redirectTo` for an emailed link.
 *
 * Always absolute and always on the resolved origin, so Supabase has something
 * concrete to match against the allowlist. `next` is where the employee ends up
 * once `/auth/confirm` has exchanged the token for a session.
 */
export function emailRedirectUrl(next: string): string {
  const target = new URL("/auth/confirm", requireAppUrl());
  target.searchParams.set("next", next);
  return target.toString();
}
