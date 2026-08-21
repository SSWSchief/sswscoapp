import LoginForm from "@/components/auth/LoginForm";
import { resolveAppUrl } from "@/lib/app-url";

/**
 * Server shell for the sign-in screen.
 *
 * Its only job is to hand the form the application's public address. The form
 * needs it to ask Supabase for a password-reset link, and reading it from
 * `window.location.origin` there was one of the ways employees ended up with
 * links to an SSO-protected Vercel alias — an administrator who happened to be
 * signed in on that host emailed one to themselves. Resolved on the server, it
 * is the same address no matter which host the browser is on.
 */
export default function LoginPage() {
  return <LoginForm appUrl={resolveAppUrl().url} />;
}
