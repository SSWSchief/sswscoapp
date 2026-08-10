import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

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
const required = [
  "email",
  "full-name",
  "employee-id",
  "project-ref",
  "environment",
  "site-url",
];
const missing = required.filter((key) => !options[key]);
if (missing.length) {
  throw new Error(
    `Missing required options: ${missing.join(", ")}. Use --key=value syntax.`,
  );
}
if (!["staging", "production"].includes(options.environment))
  throw new Error("--environment must be staging or production.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.",
  );
const configuredRef = new URL(url).hostname.split(".")[0];
if (configuredRef !== options["project-ref"])
  throw new Error("Configured Supabase URL does not match --project-ref.");
if (
  options.environment === "production" &&
  options["confirm-production"] !== configuredRef
)
  throw new Error(
    "Production invitation refused. Pass --confirm-production with the exact project ref.",
  );

const email = String(options.email).trim().toLowerCase();
const fullName = String(options["full-name"]).trim();
const employeeId = String(options["employee-id"]).trim();
const siteUrl = new URL(String(options["site-url"]));
if (!/^https:$/.test(siteUrl.protocol) && siteUrl.hostname !== "localhost")
  throw new Error("--site-url must use HTTPS except for localhost.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("--email must be valid.");
if (fullName.length < 2 || employeeId.length < 2)
  throw new Error("--full-name and --employee-id must be meaningful.");

const service = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const match = result.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === targetEmail,
    );
    if (match) return match;
    if (result.data.users.length < 1000) return null;
  }
  throw new Error("Auth directory exceeds the safe scan limit.");
}

let authUser = await findAuthUserByEmail(email);
let delivery;
const redirectTo = `${siteUrl.origin}/auth/confirm?next=/reset-password`;
if (authUser) {
  const reset = await service.auth.resetPasswordForEmail(email, { redirectTo });
  if (reset.error) throw reset.error;
  delivery = "password_reset";
} else {
  const invited = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (invited.error) throw invited.error;
  authUser = invited.data.user;
  delivery = "invitation";
}

const existing = await service
  .from("users")
  .select("id")
  .eq("email", email)
  .maybeSingle();
if (existing.error) throw existing.error;
const profileId = existing.data?.id ?? `admin-${randomUUID()}`;
const initials = fullName
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("");
const profile = await service.from("users").upsert({
  id: profileId,
  auth_user_id: authUser.id,
  employee_id: employeeId,
  full_name: fullName,
  email,
  phone: "",
  role: "management",
  access_role: "admin",
  permission_overrides: {},
  status: "active",
  initials,
  deleted_at: null,
});
if (profile.error) throw profile.error;

if (options.protect === true || options.protect === "true") {
  const protectedResult = await service.from("protected_administrators").upsert({
    user_id: profileId,
    reason: String(options.reason ?? "Approved protected administrator"),
    expires_at: options["expires-at"] ? String(options["expires-at"]) : null,
  });
  if (protectedResult.error) throw protectedResult.error;
}

console.log(
  JSON.stringify({
    status: "ready",
    environment: options.environment,
    projectRef: configuredRef,
    profileId,
    delivery,
    protected: options.protect === true || options.protect === "true",
  }),
);
