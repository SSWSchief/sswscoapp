/**
 * Retires reserved test identities from a project.
 *
 * Manual role testing during development left dispatcher and driver accounts in
 * the client's production database. They must not survive handover, but they
 * also cannot simply be dropped: audit records are immutable by design, and
 * jobs and time events reference their author. So this reports what each
 * account owns and then chooses per account — a hard delete when nothing
 * depends on it, and deactivation (`status='inactive'`, `deleted_at` set) when
 * something does, which preserves history while removing access.
 *
 * Targets are matched by exact lowercase email. Never widen this to a prefix or
 * wildcard query against production; see docs/deployment-runbook.md.
 *
 *   node scripts/retire-test-identities.mjs                       # dry run
 *   node scripts/retire-test-identities.mjs --apply \
 *     --confirm-production --project-ref=<ref>
 *
 * Without --apply nothing is written. Writing to a project whose ref does not
 * match --project-ref is refused, and writing to any project at all requires
 * --confirm-production, so a mistyped environment cannot quietly destroy data.
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
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const apply = options.apply === true;

// Exact addresses only. Reserved development identities, never real employees.
const targets = [
  "tehronporter+ssws.dispatch@gmail.com",
  "tehronporter+ssws.driver@gmail.com",
];

// Owner profiles are pinned active by enforce_owner_profile_access and must
// never appear here; refuse rather than fight the trigger.
const protectedEmails = new Set([
  "amarshall@sswsco.com",
  "tehronporter@gmail.com",
]);
for (const email of targets)
  if (protectedEmails.has(email.toLowerCase()))
    throw new Error(`${email} is a protected owner profile`);

if (apply) {
  if (options["confirm-production"] !== true)
    throw new Error("--apply requires --confirm-production");
  if (options["project-ref"] !== projectRef)
    throw new Error(
      `--project-ref must equal the configured project (${projectRef})`,
    );
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Every table that would either block a delete or lose meaning without the row.
const dependencies = [
  { table: "jobs", column: "assigned_driver_id" },
  { table: "jobs", column: "created_by_id" },
  { table: "time_entries", column: "user_id" },
  { table: "time_requests", column: "user_id" },
  { table: "pretrip_submissions", column: "driver_id" },
  { table: "job_activities", column: "actor_id" },
  { table: "notifications", column: "recipient_user_id" },
  { table: "audit_log", column: "actor_id" },
];

console.log(`project : ${projectRef}`);
console.log(`mode    : ${apply ? "APPLY" : "dry run"}\n`);

let removed = 0;
let deactivated = 0;

for (const email of targets) {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id,full_name,email,access_role,status,auth_user_id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (profileError) {
    console.error(`${email}: lookup failed — ${profileError.message}`);
    process.exitCode = 1;
    continue;
  }
  if (!profile) {
    console.log(`${email}: no profile, nothing to do`);
    continue;
  }

  const held = [];
  for (const { table, column } of dependencies) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, profile.id);
    if (error) {
      console.error(`  ${table}.${column}: ${error.message}`);
      process.exitCode = 1;
    } else if (count) held.push(`${table}.${column}=${count}`);
  }

  const hardDelete = held.length === 0;
  console.log(
    `${email}\n  profile  : ${profile.id} (${profile.access_role}, ${profile.status})`,
  );
  console.log(`  history  : ${held.length ? held.join(", ") : "none"}`);
  console.log(`  action   : ${hardDelete ? "delete" : "deactivate"}`);

  if (!apply) {
    console.log("");
    continue;
  }

  if (hardDelete) {
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", profile.id);
    if (error) {
      console.error(`  profile delete failed — ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    removed += 1;
  } else {
    const { error } = await supabase
      .from("users")
      .update({ status: "inactive", deleted_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) {
      console.error(`  deactivate failed — ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    deactivated += 1;
  }

  // Removing the auth account revokes sign-in either way; the profile above
  // decides only whether the operational history survives.
  if (profile.auth_user_id) {
    const { error } = await supabase.auth.admin.deleteUser(
      profile.auth_user_id,
    );
    if (error) {
      console.error(`  auth delete failed — ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log("  auth     : deleted");
    }
  }
  console.log("");
}

console.log(
  apply
    ? `Done. ${removed} deleted, ${deactivated} deactivated.`
    : "Dry run only. Re-run with --apply --confirm-production --project-ref=<ref>.",
);
