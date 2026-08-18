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
 *
 * This guards *production*, but it reads `.env.local`, which points at staging
 * on purpose so `npm run dev` cannot touch the client's live database. Run
 * as-is and it would check staging while its output read like a verdict on
 * production — which is exactly how a live misconfiguration survived a passing
 * check once already. So the project is named on every run and has to match
 * before anything is generated.
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

// The project this check is *meant* to guard. Not a secret: it is the hostname
// every browser already receives in `NEXT_PUBLIC_SUPABASE_URL`.
const productionProject = "doofdntdobpixqmcqfnm";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const expectedProject =
  options.project ??
  process.env.AUTH_REDIRECT_EXPECTED_PROJECT ??
  productionProject;

// Checked before the secret key is even required, so pointing at the wrong
// project fails on the mismatch rather than on some unrelated credential.
if (projectRef !== expectedProject) {
  console.error(
    [
      `Refusing to run: this would check ${projectRef}, not ${expectedProject}.`,
      "",
      `  configured (NEXT_PUBLIC_SUPABASE_URL) : ${projectRef}`,
      `  expected                              : ${expectedProject}`,
      "",
      ".env.local points at the staging project by design, so running this",
      "from a checkout checks staging while reporting what looks like a",
      "production result. Supply production credentials for one run instead:",
      "",
      "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... \\",
      "    node scripts/check-auth-redirect.mjs --email=<reserved account>",
      "",
      `To check a different project deliberately, name it: --project=${projectRef}`,
    ].join("\n"),
  );
  process.exit(1);
}

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

console.log(`project    : ${projectRef}${projectRef === productionProject ? " (production)" : ""}`);
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
