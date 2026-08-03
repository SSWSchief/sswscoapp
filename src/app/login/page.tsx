import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { Input, Label } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

// Screen 1 — Login. Static skeleton; Supabase Auth wires in during the build.
export default function LoginPage() {
  return (
    <main className="app-viewport-height safe-area-all flex items-center justify-center bg-brand-navy">
      <div className="w-full max-w-sm rounded-card bg-white border border-brand-ice shadow-2xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <LogoFull className="mb-5" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
            Welcome Back
          </h1>
          <p className="text-sm text-brand-steel mt-1">Sign in to your account</p>
        </div>

        <form className="space-y-4">
          <div>
            <Label>Email</Label>
              <Input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} enterKeyHint="next" placeholder="you@example.com" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input name="password" type="password" autoComplete="current-password" enterKeyHint="go" placeholder="Enter your password" />
              <Icon
                name="eye"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
            </div>
          </div>

          <Link
            href="/dispatcher/dashboard"
            className="flex min-h-11 w-full items-center justify-center rounded bg-brand-blue font-heading text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-navy active:bg-brand-navy"
          >
            Sign In
          </Link>
        </form>

        <div className="text-center mt-4">
          <a href="#" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-blue hover:underline">
            Forgot password?
          </a>
        </div>

        <p className="text-center text-xs text-brand-steel mt-6">
          Overwatch prototype — sign-in opens the dispatcher dashboard.
        </p>
      </div>
    </main>
  );
}
