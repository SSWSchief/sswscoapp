"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/Field";
import { LogoFull } from "@/components/ui/Logo";
import { passwordPolicyHint, passwordProblem } from "@/lib/password-policy";
export default function ResetPassword() {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const problem = passwordProblem(password);
    if (problem || password !== confirm) {
      setError(problem ?? "Passwords do not match.");
      setBusy(false);
      return;
    }
    const result = await createClient().auth.updateUser({ password });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };
  return (
    <main className="app-viewport-height flex items-center justify-center bg-brand-navy p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-card bg-white p-8 shadow-2xl"
      >
        <LogoFull className="mb-6" />
        <h1 className="font-heading text-2xl font-bold uppercase">
          Set new password
        </h1>
        <p className="mb-5 mt-1 text-sm text-brand-steel">
          {passwordPolicyHint}
        </p>
        <div className="space-y-4">
          <div>
            <Label>New password</Label>
            <Input
              required
              name="password"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input
              required
              name="confirm"
              type="password"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="min-h-11 w-full rounded bg-brand-blue font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>
    </main>
  );
}
