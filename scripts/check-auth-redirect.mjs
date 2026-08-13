/**
 * Verifies that Supabase honours the redirect the application asks for.
 *
 * Supabase silently discards a `redirectTo` that is not on the project's
 * allowlist and substitutes the Site URL instead, so a misconfigured project
 * looks healthy right up until an employee clicks an invitation and lands
 * somewhere unusable. On August 10, 2026 production's Site URL pointed at a
 * Vercel SSO-protected deployment alias and every invitation dead-ended on a
 * Vercel login page; this check exists so that regression is caught in seconds
 * rather than by a confused new hire.
 *
 * `generateLink` returns the link directly and sends no email. Point it at a
 * reserved account, never a real employee.
 *
 *   node scripts/check-auth-redirect.mjs --email=reserved@example.com
 *   node scripts/check-auth-redirect.mjs --app-url=https://sswscoapp.vercel.app
 *
 * Exits non-zero when the redirect was rewritten, so CI can gate on it.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.length ? value.join("=") : true];
  }),
);

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const email = options.email ?? process.env.AUTH_REDIRECT_CHECK_EMAIL;
if (!email)
  throw new Error(
    "Pass --email=<reserved account>. Never use a real employee address.",
  );

const appUrl = (options["app-url"] ?? "https://sswscoapp.vercel.app").replace(
  /\/$/,
  "",
);
const requested = `${appUrl}/auth/confirm?next=/reset-password`;

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo: requested },
});

if (error) {
  console.error(`Could not generate a link: ${error.message}`);
  process.exit(1);
}

const link = new URL(data.properties.action_link);
const actual = link.searchParams.get("redirect_to");
const matches = actual === requested;

console.log(`project    : ${new URL(supabaseUrl).hostname.split(".")[0]}`);
console.log(`requested  : ${requested}`);
console.log(`redirect_to: ${actual}`);

if (matches) {
  console.log("\nPASS — Supabase preserved the requested redirect.");
  process.exit(0);
}

console.error(
  [
    "\nFAIL — Supabase rewrote the redirect, so it is not on the allowlist.",
    "",
    "In Supabase → Authentication → URL Configuration set:",
    `  Site URL             ${appUrl}`,
    `  Redirect allowlist   ${appUrl}/auth/confirm`,
    `                       ${appUrl}/auth/callback`,
    `                       ${appUrl}/reset-password`,
    "",
    "The Site URL must be the public application domain. A Vercel deployment",
    "alias is SSO-protected and will dead-end every emailed link.",
  ].join("\n"),
);
process.exit(1);
