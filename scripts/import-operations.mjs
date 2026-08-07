import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const argumentsList = process.argv.slice(2);
const path = argumentsList.find((argument) => !argument.startsWith("--"));
const options = Object.fromEntries(
  argumentsList
    .filter((argument) => argument.startsWith("--"))
    .map((argument) => {
      const [key, ...value] = argument.replace(/^--/, "").split("=");
      return [key, value.length ? value.join("=") : true];
    }),
);
const apply = options.apply === true;
if (!path)
  throw new Error(
    "Usage: npm run import:validate -- <manifest.json> [--apply --environment=staging --project-ref=ref --approved-hash=sha256]",
  );

const id = z.string().trim().min(1).max(120);
const optionalText = z.string().max(2000).optional();
const userSchema = z
  .object({
    id,
    employeeId: id,
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().max(40).optional(),
    role: z.enum(["dispatcher", "driver", "office", "management"]),
    accessRole: z.enum(["admin", "dispatcher", "driver"]),
    status: z.enum(["active", "inactive"]).optional(),
    ptoBalanceHours: z.number().min(0).max(10000).optional(),
    weeklyHours: z.number().min(0).max(168).optional(),
  })
  .strict()
  .refine(
    (row) => (row.role === "driver") === (row.accessRole === "driver"),
    "Driver role and accessRole must agree",
  );
const customerSchema = z
  .object({
    id,
    name: z.string().trim().min(2).max(160),
    phone: z.string().max(40).optional(),
    email: z.union([z.literal(""), z.string().email().max(254)]).optional(),
    address: z.string().trim().min(3).max(500),
    group: z.enum(["Big GC", "Commercial", "Residential"]).optional(),
  })
  .strict();
const truckSchema = z
  .object({
    id,
    number: z.string().trim().min(1).max(40),
    type: z.string().trim().min(2).max(80).optional(),
    status: z.enum(["in_use", "down", "in_shop"]).optional(),
    licensePlate: z.string().max(40).optional(),
    mileage: z.number().int().min(0).max(10000000).optional(),
    assignedDriverId: z.string().max(120).nullable().optional(),
    notes: optionalText,
    airTagId: z.string().max(120).nullable().optional(),
    lastKnownLocation: z.string().max(500).nullable().optional(),
  })
  .strict();
const dumpsterSchema = z
  .object({
    id,
    code: z.string().trim().min(1).max(60),
    size: z.enum(["10 Yard", "20 Yard", "30 Yard", "40 Yard"]),
    status: z.enum(["out", "in_yard", "in_shop"]).optional(),
    type: z.string().trim().min(2).max(80).optional(),
    currentLocation: z.string().max(500).optional(),
    airTagId: z.string().max(120).nullable().optional(),
    notes: optionalText,
  })
  .strict();
const jobSchema = z
  .object({
    id,
    reference: z.string().trim().min(2).max(60),
    customerId: id,
    address: z.string().trim().min(3).max(500),
    phone: z.string().max(40).optional(),
    serviceType: z.enum([
      "Delivery",
      "Pick-Up",
      "Dump & Return",
      "Swap / Exchange",
      "Relocation",
      "Dry Run",
      "Service Call",
    ]),
    dumpsterSize: z.enum(["10 Yard", "20 Yard", "30 Yard", "40 Yard"]),
    assignedDriverId: z.string().max(120).nullable().optional(),
    assignedTruckId: z.string().max(120).nullable().optional(),
    assignedDumpsterId: z.string().max(120).nullable().optional(),
    scheduledFor: z.string().datetime({ offset: true }),
    status: z
      .enum(["pending", "en_route", "arrived", "complete", "cancelled"])
      .optional(),
    notes: optionalText,
    trafficInstructions: z.string().max(1000).optional(),
  })
  .strict();
const manifestSchema = z
  .object({
    users: z.array(userSchema).max(10000).optional().default([]),
    customers: z.array(customerSchema).max(100000).optional().default([]),
    trucks: z.array(truckSchema).max(10000).optional().default([]),
    dumpsters: z.array(dumpsterSchema).max(100000).optional().default([]),
    jobs: z.array(jobSchema).max(250000).optional().default([]),
  })
  .strict();

const raw = await readFile(path, "utf8");
if (Buffer.byteLength(raw) > 50 * 1024 * 1024)
  throw new Error("Import manifest exceeds the 50 MB safety limit.");
let decoded;
try {
  decoded = JSON.parse(raw);
} catch {
  throw new Error("Import manifest is not valid JSON.");
}
const parsed = manifestSchema.safeParse(decoded);
if (!parsed.success) {
  console.error(
    JSON.stringify(
      {
        status: "invalid",
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
const payload = parsed.data;
const groups = Object.keys(payload);
const errors = [];
function unique(group, field) {
  const values = new Set();
  for (const [index, row] of payload[group].entries()) {
    const value = String(row[field] ?? "").toLowerCase();
    if (values.has(value)) errors.push(`${group}[${index}].${field} is duplicated`);
    values.add(value);
  }
}
for (const group of groups) unique(group, "id");
for (const field of ["employeeId", "email"]) unique("users", field);
unique("trucks", "number");
unique("dumpsters", "code");
unique("jobs", "reference");
if (errors.length) {
  console.error(JSON.stringify({ status: "invalid", errors }, null, 2));
  process.exit(1);
}

const counts = Object.fromEntries(groups.map((group) => [group, payload[group].length]));
const canonical = JSON.stringify(payload);
const hash = createHash("sha256").update(canonical).digest("hex");
if (!apply) {
  console.log(
    JSON.stringify(
      { status: "valid", dryRun: true, sourceHash: hash, counts },
      null,
      2,
    ),
  );
  process.exit(0);
}

for (const required of ["environment", "project-ref", "approved-hash"])
  if (!options[required]) throw new Error(`--${required}=value is required for --apply.`);
if (!["staging", "production"].includes(options.environment))
  throw new Error("--environment must be staging or production.");
if (options["approved-hash"] !== hash)
  throw new Error("--approved-hash does not match the validated manifest hash.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase environment is required for --apply.");
const configuredRef = new URL(url).hostname.split(".")[0];
if (configuredRef !== options["project-ref"])
  throw new Error("Configured Supabase URL does not match --project-ref.");
if (
  options.environment === "production" &&
  options["confirm-production"] !== configuredRef
)
  throw new Error(
    "Production import refused. Pass --confirm-production with the exact project ref.",
  );

const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function verifyReferences(table, referencedIds) {
  const ids = [...new Set(referencedIds.filter(Boolean))];
  if (!ids.length) return;
  const result = await db.from(table).select("id").in("id", ids);
  if (result.error) throw result.error;
  const existing = new Set(result.data.map((row) => row.id));
  const missing = ids.filter((value) => !existing.has(value));
  if (missing.length)
    throw new Error(`${table} references are missing (${missing.length} unresolved).`);
}
const manifestIds = Object.fromEntries(
  groups.map((group) => [group, new Set(payload[group].map((row) => row.id))]),
);
await verifyReferences(
  "users",
  [
    ...payload.trucks.map((row) => row.assignedDriverId),
    ...payload.jobs.map((row) => row.assignedDriverId),
  ].filter((value) => value && !manifestIds.users.has(value)),
);
await verifyReferences(
  "customers",
  payload.jobs
    .map((row) => row.customerId)
    .filter((value) => !manifestIds.customers.has(value)),
);
await verifyReferences(
  "trucks",
  payload.jobs
    .map((row) => row.assignedTruckId)
    .filter((value) => value && !manifestIds.trucks.has(value)),
);
await verifyReferences(
  "dumpsters",
  payload.jobs
    .map((row) => row.assignedDumpsterId)
    .filter((value) => value && !manifestIds.dumpsters.has(value)),
);

const result = await db.rpc("apply_operations_import", {
  payload,
  source_name: basename(path),
  source_hash: hash,
});
if (result.error) throw result.error;
console.log(
  JSON.stringify(
    {
      status: "applied",
      environment: options.environment,
      projectRef: configuredRef,
      sourceHash: hash,
      counts,
      result: result.data,
    },
    null,
    2,
  ),
);
