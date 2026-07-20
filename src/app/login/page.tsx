import Link from "next/link";
import { LogoFull } from "@/components/ui/Logo";
import { Input, Label } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

// Screen 1 — Login. Static skeleton; Supabase Auth wires in during the build.
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-card bg-white border border-gray-200 shadow-card p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <LogoFull className="mb-5" />
          <h1 className="text-xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input type="password" placeholder="Enter your password" />
              <Icon
                name="eye"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                width={18}
                height={18}
              />
            </div>
          </div>

          <Link
            href="/dispatcher/dashboard"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-medium text-white transition-colors hover:bg-[#003a86]"
          >
            Sign In
          </Link>
        </form>

        <div className="text-center mt-4">
          <a href="#" className="text-sm text-brand-500 hover:underline">
            Forgot password?
          </a>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Demo skeleton — sign-in opens the dispatcher dashboard.
        </p>
      </div>
    </main>
  );
}
