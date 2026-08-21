/**
 * Verifies that an emailed link actually reaches the application.
 *
 * Supabase silently discards a `redirectTo` that is not on the project's
 * allowlist and substitutes the Site URL instead, so a misconfigured project
 * looks healthy right up until an employee clicks an invitation and lands
 * somewhere unusable. On August 10, 2026 production's Site URL pointed at a
 * Vercel SSO-protected deployment alias and every invitation dead-ended on a
 * Vercel login page; this check exists so that regression is caught in seconds
 * rather than by a confused new hire.
 *
 * That first version only compared the redirect it asked for against the one it
 * got back, and on August 20, 2026 it would have reported PASS while every
 * invitation dead-ended. The allowlist was intact; the *Site URL* had drifted
 * back to `sswscoapp-silver-state-waste-solutions.vercel.app`, and the Site URL
 * is what a link falls back to whenever no redirect is supplied — which is what
 * `inviteUserByEmail` was doing — and what `{{ .SiteURL }}` interpolates to in
 * a template. So three things are checked now, not one:
 *
 *   1. a requested redirect survives the allowlist,
 *   2. the Site URL a link falls back to is the public application,
 *   3. neither address is behind Vercel Deployment Protection.
 *
 * The third is the check that names the actual symptom. A protected host
 * answers with a redirect to `vercel.com/sso-api`, which is the "sign up for an
 * account" page employees kept landing on.
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

// The same value the application resolves at runtime, so the check and the
// deployment cannot disagree about which address is the real one.
const appUrl = (
  options["app-url"] ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://sswscoapp.vercel.app"
).replace(/\/$/, "");
const requested = `${appUrl}/auth/confirm?next=/reset-password`;

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const generate = async (options) => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options,
  });
  if (error) {
    console.error(`Could not generate a link: ${error.message}`);
    process.exit(1);
  }
  return new URL(data.properties.action_link);
};

/**
 * Whether a host serves the application or Vercel's login wall.
 *
 * Deployment Protection answers a protected alias with a 30x to
 * `vercel.com/sso-api`, so the emailed link never reaches the application at
 * all. Redirects are deliberately not followed: the first response is the
 * evidence.
 */
const protection = async (target) => {
  let response;
  try {
    response = await fetch(target, { redirect: "manual" });
  } catch (cause) {
    return { ok: false, detail: `unreachable (${cause.message})` };
  }
  const location = response.headers.get("location") ?? "";
  if (/vercel\.com\/sso-api|\/\.well-known\/vercel-user-meta/.test(location))
    return { ok: false, detail: "behind Vercel Deployment Protection" };
  if (response.status >= 500)
    return { ok: false, detail: `HTTP ${response.status}` };
  return { ok: true, detail: `HTTP ${response.status}` };
};

const requestedLink = await generate({ redirectTo: requested });
const actual = requestedLink.searchParams.get("redirect_to");

// No redirect asked for, so Supabase substitutes the Site URL — the fallback
// every invitation used while `inviteUserByEmail` passed nothing, and the value
// `{{ .SiteURL }}` expands to in the email templates.
const fallbackLink = await generate({});
const siteUrl = fallbackLink.searchParams.get("redirect_to");

const appOrigin = new URL(appUrl).origin;
const appReachable = await protection(appUrl);
const siteReachable = siteUrl
  ? await protection(new URL(siteUrl).origin)
  : { ok: false, detail: "not reported" };

const failures = [];
if (actual !== requested)
  failures.push({
    what: "The requested redirect was rewritten, so it is not on the allowlist.",
    fix: [
      "Supabase → Authentication → URL Configuration → Redirect URLs:",
      `  ${appOrigin}/**`,
    ],
  });
if (!siteUrl || new URL(siteUrl).origin !== appOrigin)
  failures.push({
    what: `The Site URL is ${siteUrl ?? "unset"}, not ${appOrigin}. Every link that supplies no redirect — and every template using {{ .SiteURL }} — goes there.`,
    fix: [
      "Supabase → Authentication → URL Configuration → Site URL:",
      `  ${appOrigin}`,
    ],
  });
if (!appReachable.ok)
  failures.push({
    what: `${appOrigin} is ${appReachable.detail}, so employees cannot open a link to it.`,
    fix: [
      "Vercel → Project → Settings → Deployment Protection: leave the",
      "production domain public, or use a custom domain that is.",
    ],
  });
if (siteUrl && new URL(siteUrl).origin === appOrigin && !siteReachable.ok)
  failures.push({
    what: `The Site URL host is ${siteReachable.detail}.`,
    fix: ["Vercel → Project → Settings → Deployment Protection."],
  });

console.log(`project    : ${projectRef}${projectRef === productionProject ? " (production)" : ""}`);
console.log(`app url    : ${appOrigin}  (${appReachable.detail})`);
console.log(`requested  : ${requested}`);
console.log(`redirect_to: ${actual}`);
console.log(`site url   : ${siteUrl ?? "(not reported)"}  (${siteReachable.detail})`);

if (failures.length === 0) {
  console.log(
    "\nPASS — the redirect survives, the Site URL is the application, and both are publicly reachable.",
  );
  process.exit(0);
}

console.error(
  [
    `\nFAIL — ${failures.length} problem${failures.length === 1 ? "" : "s"} will stop emailed links from working.`,
    ...failures.flatMap((failure, index) => [
      "",
      `${index + 1}. ${failure.what}`,
      ...failure.fix.map((line) => `   ${line}`),
    ]),
  ].join("\n"),
);
process.exit(1);
