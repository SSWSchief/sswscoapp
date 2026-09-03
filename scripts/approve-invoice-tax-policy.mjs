/**
 * Records the Nevada tax treatment decision that gates live invoicing.
 *
 * `sendInvoice` refuses to send under a live Stripe key until
 * `company_settings.tax_policy_status` reads `non_taxable_approved`, and the
 * settings RPC deliberately cannot write that column — otherwise a dispatcher
 * could approve the company's own tax position from the settings screen. The
 * decision belongs to the account owner acting on the CPA's advice, so it is
 * made here instead, once, with the reason recorded.
 *
 * `company_settings` carries an audit trigger, so the change writes its own
 * audit_log row; `--note` is what makes that row mean something a year later.
 *
 *   node scripts/approve-invoice-tax-policy.mjs                    # read current state
 *   node scripts/approve-invoice-tax-policy.mjs --apply \
 *     --status=non_taxable_approved \
 *     --note="CPA J. Rivera, 2026-09-03: roll-off hauling is a non-taxable service in NV" \
 *     --confirm-production --project-ref=<ref>
 *
 * Without --apply nothing is written. `follow_up_required` is the honest
 * setting when the CPA finds any taxable item: it leaves live sending blocked
 * and records why.
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

const allowed = new Set(["pending", "non_taxable_approved", "follow_up_required"]);

if (apply) {
  if (!allowed.has(options.status))
    throw new Error(`--status must be one of ${[...allowed].join(", ")}`);
  // An approval with no recorded reason is the failure mode this script exists
  // to prevent: nobody can later tell who decided, or on what advice.
  if (typeof options.note !== "string" || options.note.trim().length < 10)
    throw new Error("--note must record who approved this and on what advice");
  if (options["confirm-production"] !== true)
    throw new Error("--apply requires --confirm-production");
  if (options["project-ref"] !== projectRef)
    throw new Error(`--project-ref must equal the configured project (${projectRef})`);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const current = await supabase
  .from("company_settings")
  .select("tax_policy_status,tax_policy_approved_at,tax_policy_note")
  .eq("id", true)
  .maybeSingle();
if (current.error) throw current.error;
if (!current.data) throw new Error("Company settings row is missing");

console.log(`project : ${projectRef}`);
console.log(`mode    : ${apply ? "APPLY" : "read only"}\n`);
console.log("current tax policy");
console.log(`  status      : ${current.data.tax_policy_status}`);
console.log(`  approved at : ${current.data.tax_policy_approved_at ?? "—"}`);
console.log(`  note        : ${current.data.tax_policy_note || "—"}`);

if (!apply) {
  console.log("\nNothing written. Re-run with --apply to record a decision.");
  process.exit(0);
}

const status = options.status;
const saved = await supabase
  .from("company_settings")
  .update({
    tax_policy_status: status,
    // Only an approval carries a timestamp; the other states are open
    // questions rather than decisions.
    tax_policy_approved_at:
      status === "non_taxable_approved" ? new Date().toISOString() : null,
    tax_policy_note: options.note.trim(),
  })
  .eq("id", true)
  .select("tax_policy_status,tax_policy_approved_at,tax_policy_note")
  .single();
if (saved.error) throw saved.error;

console.log("\nrecorded");
console.log(`  status      : ${saved.data.tax_policy_status}`);
console.log(`  approved at : ${saved.data.tax_policy_approved_at ?? "—"}`);
console.log(`  note        : ${saved.data.tax_policy_note}`);
console.log(
  status === "non_taxable_approved"
    ? "\nLive invoicing is no longer blocked by the tax gate."
    : "\nLive invoicing remains blocked by the tax gate.",
);
