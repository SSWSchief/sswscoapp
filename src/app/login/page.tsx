"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogoFull } from "@/components/ui/Logo";
import { Input, Label } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

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
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
    if (resetError) setError(resetError.message);
    else
      setMessage(
        "Password reset instructions were sent if that account exists.",
      );
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
            <Label>Email</Label>
            <Input
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
            <Label>Password</Label>
            <div className="relative">
              <Input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Enter your password"
              />
              <Icon
                name="eye"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
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
            disabled={submitting}
            className="flex min-h-11 w-full items-center justify-center rounded bg-brand-blue font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-navy disabled:opacity-60"
          >
            {submitting ? "Signing In…" : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={resetPassword}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand-blue hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <p className="text-center text-xs text-brand-steel mt-6">
          Secure employee access powered by Supabase Auth.
        </p>
      </div>
    </main>
  );
}
