import { appendFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
if (process.env.STAGING_ACCEPTANCE !== "true")
  throw new Error("Refusing to bootstrap without STAGING_ACCEPTANCE=true");
const url = required("NEXT_PUBLIC_SUPABASE_URL");
required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const stagingRef = required("STAGING_PROJECT_REF");
const hostRef = new URL(url).hostname.split(".")[0];
if (hostRef !== stagingRef)
  throw new Error(
    "STAGING_PROJECT_REF does not match the configured Supabase URL",
  );
if (
  process.env.PRODUCTION_PROJECT_REF &&
  stagingRef === process.env.PRODUCTION_PROJECT_REF
)
  throw new Error("Refusing to bootstrap the production project");
if (!process.env.GITHUB_ENV)
  throw new Error(
    "This bootstrap is restricted to GitHub Actions staging runs",
  );

const service = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = () => `${randomBytes(18).toString("base64url")}aA7!`;
const suffix = stagingRef.slice(0, 8);
const identities = [
  {
    key: "ADMIN",
    employeeId: "E2E-ADMIN",
    name: "E2E Administrator",
    email: `e2e-admin-${suffix}@example.invalid`,
    role: "management",
    accessRole: "admin",
    status: "active",
    overrides: {},
  },
  {
    key: "DISPATCHER",
    employeeId: "E2E-DISPATCH",
    name: "E2E Dispatcher",
    email: `e2e-dispatch-${suffix}@example.invalid`,
    role: "dispatcher",
    accessRole: "dispatcher",
    status: "active",
    overrides: {},
  },
  {
    key: "DRIVER",
    employeeId: "E2E-DRIVER",
    name: "E2E Driver",
    email: `e2e-driver-${suffix}@example.invalid`,
    role: "driver",
    accessRole: "driver",
    status: "active",
    overrides: {},
  },
  {
    key: "INACTIVE",
    employeeId: "E2E-INACTIVE",
    name: "E2E Inactive",
    email: `e2e-inactive-${suffix}@example.invalid`,
    role: "driver",
    accessRole: "driver",
    status: "inactive",
    overrides: {},
  },
  {
    key: "REDUCED",
    employeeId: "E2E-REDUCED",
    name: "E2E Reduced",
    email: `e2e-reduced-${suffix}@example.invalid`,
    role: "dispatcher",
    accessRole: "dispatcher",
    status: "active",
    overrides: { customers: false, jobs: false },
  },
  {
    key: "OTHER_DRIVER",
    employeeId: "E2E-OTHER",
    name: "E2E Other Driver",
    email: `e2e-other-${suffix}@example.invalid`,
    role: "driver",
    accessRole: "driver",
    status: "active",
    overrides: {},
  },
];

const authUsers = await service.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (authUsers.error) throw authUsers.error;
for (const identity of identities) {
  const existing = authUsers.data.users.find(
    (user) => user.email?.toLowerCase() === identity.email,
  );
  if (existing) {
    const removed = await service.auth.admin.deleteUser(existing.id);
    if (removed.error) throw removed.error;
  }
  identity.password = password();
  const created = await service.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
    user_metadata: { full_name: identity.name },
  });
  if (created.error) throw created.error;
  identity.authId = created.data.user.id;
  const prior = await service
    .from("users")
    .select("id")
    .eq("employee_id", identity.employeeId)
    .maybeSingle();
  if (prior.error) throw prior.error;
  identity.profileId =
    prior.data?.id ?? `e2e-${identity.key.toLowerCase().replaceAll("_", "-")}`;
  const profile = await service.from("users").upsert(
    {
      id: identity.profileId,
      auth_user_id: identity.authId,
      employee_id: identity.employeeId,
      full_name: identity.name,
      email: identity.email,
      phone: "",
      role: identity.role,
      access_role: identity.accessRole,
      permission_overrides: identity.overrides,
      status: identity.status,
      initials: identity.name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2),
      deleted_at: null,
    },
    { onConflict: "id" },
  );
  if (profile.error) throw profile.error;
}

const byKey = Object.fromEntries(
  identities.map((identity) => [identity.key, identity]),
);
const fixtureUserIds = identities.map((identity) => identity.profileId);
const fixtureJobIds = ["e2e-driver-job", "e2e-other-job"];
const fixtureTruckIds = ["e2e-truck"];
const fixtureDumpsterIds = ["e2e-dumpster"];

const cleanupWrites = [
  service.from("export_audit").delete().in("requested_by_id", fixtureUserIds),
  service.from("invoices").delete().in("job_id", fixtureJobIds),
  service.from("message_reads").delete().in("user_id", fixtureUserIds),
  service.from("messages").delete().in("sender_id", fixtureUserIds),
  service
    .from("message_channel_members")
    .delete()
    .in("user_id", fixtureUserIds),
  service.from("message_channels").delete().in("created_by_id", fixtureUserIds),
  service.from("sop_acknowledgements").delete().in("user_id", fixtureUserIds),
  service.from("pretrip_submissions").delete().in("driver_id", fixtureUserIds),
  service.from("absence_events").delete().in("user_id", fixtureUserIds),
  service.from("time_requests").delete().in("user_id", fixtureUserIds),
  service.from("time_entries").delete().in("user_id", fixtureUserIds),
  service
    .from("notifications")
    .delete()
    .in("recipient_user_id", fixtureUserIds),
  service
    .from("trucks")
    .update({ current_job_id: null })
    .in("id", fixtureTruckIds),
  service
    .from("dumpsters")
    .update({
      current_job_id: null,
      current_customer_id: null,
      current_location: "Yard",
      status: "in_yard",
    })
    .in("id", fixtureDumpsterIds),
  service.from("jobs").delete().in("id", fixtureJobIds),
];
for (const write of cleanupWrites) {
  const result = await write;
  if (result.error) throw result.error;
}

const settingsReset = await service.from("company_settings").upsert({
  id: true,
  company_name: "Silver State Waste Solutions",
  address: "100 Test Way",
  phone: "555-0100",
  email: "dispatch@example.invalid",
  time_zone: "America/Los_Angeles",
  date_format: "MM/DD/YYYY",
  message_retention_days: 365,
  invoice_prefix: "INV",
});
if (settingsReset.error) throw settingsReset.error;

const fixtureWrites = [
  service.from("customers").upsert({
    id: "e2e-customer",
    name: "E2E Customer",
    phone: "555-0100",
    email: "e2e-customer@example.invalid",
    address: "100 Test Way",
    billing_contact_name: "E2E Accounts Payable",
    billing_email: "e2e-customer@example.invalid",
    billing_address_line1: "100 Test Way",
    billing_address_line2: "",
    billing_city: "Reno",
    billing_state: "NV",
    billing_postal_code: "89501",
    billing_country: "US",
    customer_group: "Commercial",
    is_active: true,
    deleted_at: null,
  }),
  service.from("customers").upsert({
    id: "e2e-other-customer",
    name: "E2E Other Customer",
    phone: "555-0101",
    email: "e2e-other@example.invalid",
    address: "200 Test Way",
    billing_contact_name: "E2E Other Accounts Payable",
    billing_email: "e2e-other@example.invalid",
    billing_address_line1: "200 Test Way",
    billing_address_line2: "",
    billing_city: "Reno",
    billing_state: "NV",
    billing_postal_code: "89502",
    billing_country: "US",
    customer_group: "Commercial",
    is_active: true,
    deleted_at: null,
  }),
  service.from("trucks").upsert({
    id: "e2e-truck",
    number: "E2E-T1",
    type: "Roll-off Truck",
    status: "in_use",
    license_plate: "E2ET1",
    mileage: 1000,
    assigned_driver_id: byKey.DRIVER.profileId,
    notes: "Acceptance fixture",
    deleted_at: null,
  }),
  service.from("dumpsters").upsert({
    id: "e2e-dumpster",
    code: "E2E-D1",
    size: "20 Yard",
    status: "in_yard",
    type: "Roll-off",
    current_location: "Yard",
    notes: "Acceptance fixture",
    deleted_at: null,
  }),
];
for (const write of fixtureWrites) {
  const result = await write;
  if (result.error) throw result.error;
}
// Clear invoices raised against the acceptance customers by earlier runs.
// The billing suite saves a real draft, and a completed job can sit on only one
// active invoice, so without this the second run finds nothing eligible and
// quietly skips the very assertions it exists to make. Children first: invoice
// lines and job links are ON DELETE RESTRICT, and the revision pointers are
// self-referencing, so they are broken before the rows go.
const acceptanceCustomers = ["e2e-customer", "e2e-other-customer"];
const staleInvoices = await service
  .from("invoices")
  .select("id")
  .in("customer_id", acceptanceCustomers);
if (staleInvoices.error) throw staleInvoices.error;
const staleIds = (staleInvoices.data ?? []).map((invoice) => invoice.id);
if (staleIds.length) {
  for (const step of [
    service.from("invoices").update({ latest_revision_id: null, revised_from_id: null }).in("id", staleIds),
    service.from("invoice_line_items").delete().in("invoice_id", staleIds),
    service.from("invoice_jobs").delete().in("invoice_id", staleIds),
    service.from("invoices").delete().in("id", staleIds),
  ]) {
    const result = await step;
    if (result.error) throw result.error;
  }
  console.log(`Cleared ${staleIds.length} acceptance invoice(s) from a previous run.`);
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
for (const job of [
  {
    id: "e2e-driver-job",
    reference: "#E2E-DRIVER",
    customer_id: "e2e-customer",
    assigned_driver_id: byKey.DRIVER.profileId,
  },
  {
    id: "e2e-other-job",
    reference: "#E2E-OTHER",
    customer_id: "e2e-other-customer",
    assigned_driver_id: byKey.OTHER_DRIVER.profileId,
  },
  // A completed job, because only completed work can be invoiced. Without one
  // the billing half of the acceptance suite skips itself for want of an
  // eligible job and proves nothing about the money path.
  {
    id: "e2e-billable-job",
    reference: "#E2E-BILLABLE",
    customer_id: "e2e-customer",
    assigned_driver_id: byKey.DRIVER.profileId,
    status: "complete",
  },
]) {
  const result = await service.from("jobs").upsert({
    address: "100 Test Way",
    phone: "555-0100",
    service_type: "Delivery",
    dumpster_size: "20 Yard",
    scheduled_for: tomorrow,
    status: "pending",
    notes: "Acceptance fixture",
    deleted_at: null,
    ...job,
  });
  if (result.error) throw result.error;
}

const env = identities
  .filter((identity) => identity.key !== "OTHER_DRIVER")
  .flatMap((identity) => [
    `E2E_${identity.key}_EMAIL=${identity.email}`,
    `E2E_${identity.key}_PASSWORD=${identity.password}`,
  ]);
for (const value of identities.map((identity) => identity.password))
  process.stdout.write(`::add-mask::${value}\n`);
await appendFile(process.env.GITHUB_ENV, `${env.join("\n")}\n`, {
  mode: 0o600,
});
console.log(`Staging acceptance fixtures prepared for project ${stagingRef}.`);
