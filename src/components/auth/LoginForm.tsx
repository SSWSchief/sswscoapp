"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import { Input, Label } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import {
  emailDeliveryEnabled,
  passwordRecoveryGuidance,
} from "@/lib/email-delivery";

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Tokens from an emailed link that arrived in the URL fragment.
 *
 * Supabase puts them there whenever the template uses the default
 * `{{ .ConfirmationURL }}`, and a fragment is never sent to a server, so
 * `/auth/confirm` bounces those links here rather than redeeming them. Reading
 * the fragment in the browser is the only place the exchange can happen — and
 * doing it means onboarding survives a template nobody remembered to edit.
 */
function emailedLinkFragment() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const values = new URLSearchParams(hash);
  const accessToken = values.get("access_token");
  const refreshToken = values.get("refresh_token");
  if (accessToken && refreshToken)
    return { accessToken, refreshToken, errorCode: null } as const;
  const errorCode = values.get("error_code") ?? values.get("error");
  return errorCode
    ? ({ accessToken: null, refreshToken: null, errorCode } as const)
    : null;
}

const expiredLinkMessage =
  "That sign-in link is invalid or has expired. Ask an administrator to send a new one.";

export default function LoginForm({ appUrl }: { appUrl: string }) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    const query = new URLSearchParams(window.location.search);
    const fragment = emailedLinkFragment();
    // The link carried a usable session in its fragment. Establish it and send
    // the employee on to set a password, exactly as a server-redeemed link
    // would have. The fragment is cleared first so the tokens are not left in
    // the address bar or in history.
    if (fragment?.accessToken && fragment.refreshToken) {
      const { accessToken, refreshToken } = fragment;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setSubmitting(true);
      void createClient()
        .auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ error: sessionError }) => {
          setSubmitting(false);
          if (sessionError) {
            setError(expiredLinkMessage);
            return;
          }
          router.replace(safeInternalPath(query.get("next")) ?? "/reset-password");
          router.refresh();
        });
      return;
    }
    // A failed invitation or reset link redirects here. Without this the failure
    // is silent and the employee has no idea their link expired.
    const reason = query.get("error");
    if (fragment?.errorCode || reason === "auth_confirm" || reason === "auth_callback")
      setError(expiredLinkMessage);
  }, [router]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      },
    );
    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("access_role")
      .eq("auth_user_id", data.user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      setError(
        "Your employee account is inactive or not linked. Contact an administrator.",
      );
      setSubmitting(false);
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("next");
    const fallback =
      profile?.access_role === "driver"
        ? "/driver/jobs"
        : profile?.access_role === "admin"
          ? "/management"
          : "/dispatcher/dashboard";
    router.replace(safeInternalPath(requested) ?? fallback);
    router.refresh();
  };

  // Only reachable while email delivery is on; the control is replaced with
  // static guidance otherwise, so there is nothing here to short-circuit.
  const resetPassword = async () => {
    const email = (
      document.querySelector<HTMLInputElement>('input[name="email"]')?.value ??
      ""
    ).trim();
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    const { error: resetError } =
      await createClient().auth.resetPasswordForEmail(email, {
        // Not `window.location.origin`. An administrator signed in on the
        // SSO-protected Vercel alias would otherwise email themselves a link
        // back to a Vercel login page.
        redirectTo: `${appUrl}/auth/confirm?next=/reset-password`,
      });
    if (resetError) setError(resetError.message);
    else setMessage(passwordRecoveryGuidance(true));
  };

  return (
    <main className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-navy">
      <div className="w-full max-w-sm rounded-card bg-white border border-brand-ice shadow-2xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <LogoFull className="mb-5" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
            Welcome Back
          </h1>
          <p className="text-sm text-brand-steel mt-1">
            Sign in to your account
          </p>
        </div>

        <form className="space-y-4" onSubmit={signIn}>
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Enter your password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded text-brand-steel hover:text-brand-blue"
              >
                <Icon name="eye" width={18} height={18} />
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-status-cancelled">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-status-complete">
              {message}
            </p>
          )}
          <button
            disabled={!hydrated || submitting}
            className="flex min-h-11 w-full items-center justify-center rounded bg-brand-blue font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
          >
            {submitting ? "Signing In…" : "Sign In"}
          </button>
        </form>

        {/* A reset button that cannot send anything is worse than no button:
            it looks like it acted, so the employee waits for mail that will
            never arrive. Until SMTP is configured, say so plainly instead. */}
        <div className="text-center mt-4">
          {emailDeliveryEnabled() ? (
            <button
              type="button"
              onClick={resetPassword}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-blue hover:underline"
            >
              Forgot password?
            </button>
          ) : (
            <p className="text-sm text-brand-steel">
              Forgotten your password? {passwordRecoveryGuidance(false)}
            </p>
          )}
        </div>
        <p className="text-center text-xs text-brand-steel mt-6">
          Secure employee access powered by Supabase Auth.
        </p>
      </div>
    </main>
  );
}
