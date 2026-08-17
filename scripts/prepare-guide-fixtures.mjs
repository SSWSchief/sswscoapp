/**
 * Puts the staging project into the state the guide screenshots need.
 *
 * The capture run cannot invent its own subject matter: the driver section
 * needs an assigned job, the pre-trip and SOP screens are empty until an
 * administrator publishes content, and none of it may be a real record. This
 * script creates exactly that, and only that:
 *
 *   1. the controlled training dataset (customer, truck, dumpster, job, invoice)
 *   2. a published pre-trip checklist, if none is published
 *   3. a published SOP, if none is published
 *   4. a driver employee obviously named as practice, with an Auth account
 *   5. #TRAINING-001 assigned to that driver, with the training truck and dumpster
 *
 * Every step is idempotent, so re-running changes nothing. Staging only — it
 * refuses to start against the production project.
 *
 *   node scripts/prepare-guide-fixtures.mjs
 *
 * The administrator it acts as comes from GUIDE_ADMIN_EMAIL, defaulting to the
 * support administrator pinned by migration 202608060009_owner_profiles.sql.
 */

import {
  authenticatedClient,
  loadEnvironment,
  serviceClient,
} from "./guide-environment.mjs";

const DRIVER = {
  id: "training-v1-driver",
  employeeId: "TRAINING-DRV",
  fullName: "TRAINING Driver",
  email: "training-driver@sswsco.invalid",
  initials: "TD",
};

const CHECKLIST = {
  title: "Daily Truck Pre-Trip",
  items: [
    "Brakes and air lines",
    "Tires, wheels, and lugs",
    "Lights and reflectors",
    "Hydraulics and hoses",
    "Fluid levels",
    "Mirrors and glass",
    "Horn, wipers, and washers",
    "Cab, seat belt, and fire extinguisher",
  ],
};

const SOP = {
  title: "Roll-off Container Placement",
  category: "Procedure",
  body: [
    "TRAINING CONTENT — this is example text for the app guide, not company policy.",
    "",
    "1. Confirm the placement area is level, clear of overhead lines, and wide enough for the truck to back in.",
    "2. Set the parking brake and check mirrors before raising the hoist.",
    "3. Place the container square to the approach so it can be collected without repositioning.",
    "4. Photograph the placed container before leaving the site.",
    "5. Record anything that stopped you from placing as ordered in the job notes.",
  ].join("\n"),
};

/**
 * A time still inside the current Pacific day, so the job lands on the driver's
 * **Today** tab rather than Upcoming. `driverJobsForWindow` splits on Pacific
 * midnight, so a naive "now + 3 hours" quietly moves the job — and empties the
 * screen the guide's driver section is built around — whenever the script runs
 * late in the evening.
 */
function laterToday() {
  const pacificNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
  );
  const endOfDay = new Date(pacificNow);
  endOfDay.setHours(23, 0, 0, 0);
  const preferred = new Date(Date.now() + 3 * 3600_000);
  const remainingMs = endOfDay.getTime() - pacificNow.getTime();
  return remainingMs > 3 * 3600_000
    ? preferred.toISOString()
    : new Date(Date.now() + Math.max(remainingMs / 2, 5 * 60_000)).toISOString();
}

const config = loadEnvironment();
const service = serviceClient(config);
const adminEmail = process.env.GUIDE_ADMIN_EMAIL ?? "tehronporter@gmail.com";

console.log(`project: ${config.ref}`);
console.log(`acting as: ${adminEmail}`);

/* ------------------------------------------------------- administrator check */

const { data: adminProfile, error: adminError } = await service
  .from("users")
  .select("id,full_name,access_role,status")
  .ilike("email", adminEmail)
  .maybeSingle();
if (adminError) throw new Error(adminError.message);
if (!adminProfile)
  throw new Error(
    `No employee profile on ${config.ref} has the email ${adminEmail}. ` +
      "Set GUIDE_ADMIN_EMAIL to an active administrator on this project.",
  );
if (adminProfile.access_role !== "admin" || adminProfile.status !== "active")
  throw new Error(
    `${adminEmail} is ${adminProfile.status} with access role ${adminProfile.access_role}; an active administrator is required.`,
  );

const admin = await authenticatedClient(service, config, adminEmail);

/* --------------------------------------------------------- training dataset */

const status = await admin.rpc("get_training_dataset_status");
if (status.error) throw new Error(status.error.message);

// A job's status may only move forward — `jobs` has a trigger rejecting
// anything else — so a training job left at `arrived` by an earlier capture
// cannot be rewound in place. Removing and re-provisioning the dataset is the
// supported way back to a pending job, and it is what an administrator would
// do from Settings → Training Data.
const { data: existingJob } = await service
  .from("jobs")
  .select("status")
  .eq("id", "training-v1-job")
  .maybeSingle();

if (status.data?.status === "active" && existingJob?.status === "pending") {
  console.log("· training dataset active with a pending job");
} else {
  if (status.data?.status === "active") {
    const removed = await admin.rpc("remove_training_dataset", {
      requested_dataset_key: "training-v1",
    });
    if (removed.error) throw new Error(removed.error.message);
    console.log(
      `· removed the previous training dataset (job was ${existingJob?.status ?? "missing"})`,
    );
  }
  const provisioned = await admin.rpc("provision_training_dataset");
  if (provisioned.error) throw new Error(provisioned.error.message);
  console.log("· training dataset provisioned");
}

/* ------------------------------------------------------ published checklist */

const { data: templates, error: templateError } = await service
  .from("pretrip_templates")
  .select("id,title,version,is_published")
  .eq("is_published", true);
if (templateError) throw new Error(templateError.message);
if (templates.length) {
  console.log(`· checklist already published (${templates[0].title} v${templates[0].version})`);
} else {
  const published = await admin.rpc("publish_pretrip_template", {
    template_title: CHECKLIST.title,
    item_labels: CHECKLIST.items,
  });
  if (published.error) throw new Error(published.error.message);
  console.log(`· published checklist ${CHECKLIST.title}`);
}

/* ------------------------------------------------------------ published SOP */

const { data: sops, error: sopError } = await service
  .from("sop_documents")
  .select("id,title,version,is_published")
  .eq("is_published", true);
if (sopError) throw new Error(sopError.message);
if (sops.length) {
  console.log(`· SOP already published (${sops[0].title} v${sops[0].version})`);
} else {
  const published = await admin.rpc("publish_sop_document", {
    sop_title: SOP.title,
    sop_category: SOP.category,
    sop_body: SOP.body,
    required_for_drivers: true,
  });
  if (published.error) throw new Error(published.error.message);
  console.log(`· published SOP ${SOP.title}`);
}

/* --------------------------------------------------------- practice driver */

const { data: existingDriver, error: driverLookupError } = await service
  .from("users")
  .select("id,auth_user_id,status,access_role")
  .eq("id", DRIVER.id)
  .maybeSingle();
if (driverLookupError) throw new Error(driverLookupError.message);

if (!existingDriver) {
  const { error } = await service.from("users").insert({
    id: DRIVER.id,
    employee_id: DRIVER.employeeId,
    full_name: DRIVER.fullName,
    email: DRIVER.email,
    phone: "",
    role: "driver",
    access_role: "driver",
    status: "active",
    initials: DRIVER.initials,
    pto_balance_hours: 24,
    weekly_hours: 0,
  });
  if (error) throw new Error(`Could not create the practice driver: ${error.message}`);
  console.log(`· created employee ${DRIVER.fullName}`);
} else {
  console.log(`· employee ${DRIVER.fullName} already exists`);
}

// The Auth account is what the capture run signs in as. `link_auth_user`
// attaches it to the profile above by matching email.
const { data: authList, error: authListError } = await service.auth.admin.listUsers({
  perPage: 1000,
});
if (authListError) throw new Error(authListError.message);
let driverAuth = authList.users.find(
  (user) => user.email?.toLowerCase() === DRIVER.email,
);
if (!driverAuth) {
  const created = await service.auth.admin.createUser({
    email: DRIVER.email,
    email_confirm: true,
    user_metadata: { full_name: DRIVER.fullName },
  });
  if (created.error)
    throw new Error(`Could not create the driver Auth account: ${created.error.message}`);
  driverAuth = created.data.user;
  console.log("· created the driver Auth account");
} else {
  console.log("· driver Auth account already exists");
}

const { error: linkError } = await service
  .from("users")
  .update({ auth_user_id: driverAuth.id, status: "active" })
  .eq("id", DRIVER.id);
if (linkError) throw new Error(`Could not link the driver account: ${linkError.message}`);

/* --------------------------------------------------------- assign the job */

const { data: job, error: jobError } = await service
  .from("jobs")
  .select("id,reference,status,assigned_driver_id")
  .eq("id", "training-v1-job")
  .maybeSingle();
if (jobError) throw new Error(jobError.message);
if (!job) throw new Error("The training job is missing; provisioning did not complete.");

const { error: assignError } = await service
  .from("jobs")
  .update({
    assigned_driver_id: DRIVER.id,
    assigned_truck_id: "training-v1-truck",
    assigned_dumpster_id: "training-v1-dumpster",
    scheduled_for: laterToday(),
  })
  .eq("id", "training-v1-job");
if (assignError)
  throw new Error(`Could not assign the training job: ${assignError.message}`);

await service
  .from("job_events")
  .update({ occurred_at: new Date().toISOString() })
  .eq("job_id", "training-v1-job")
  .eq("event_type", "assigned");

console.log(`· ${job.reference} assigned to ${DRIVER.fullName}`);

/* ------------------------------------------------------------ time entries */

/**
 * Clears the practice driver's own time events and requests.
 *
 * The capture clocks the driver in and takes a break so the Time screen shows a
 * running timer and a real list. Those events are not part of the training
 * dataset, so without this every run stacks another break pair onto the same
 * day until the screenshot is a wall of entries.
 */
for (const table of ["time_entries", "time_requests"]) {
  const { error } = await service.from(table).delete().eq("user_id", DRIVER.id);
  if (error) console.warn(`  (could not clear ${table}: ${error.message})`);
}
console.log("· cleared the practice driver's time events");

/* --------------------------------------------------------- announcement */

/**
 * One company announcement, so both Messages screens show a real thread instead
 * of "No messages in this channel." Posted only when the channel is empty, so
 * repeat runs do not stack copies.
 */
const { data: channel } = await service
  .from("message_channels")
  .select("id,name,kind")
  .eq("kind", "announcement")
  .limit(1)
  .maybeSingle();

if (!channel) {
  console.log("· no announcement channel on this project — skipping");
} else {
  const { count } = await service
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channel.id);
  if (count) {
    console.log(`· announcement channel already has ${count} message(s)`);
  } else {
    const { error } = await service.from("messages").insert({
      channel_id: channel.id,
      sender_id: adminProfile.id,
      body:
        "TRAINING MESSAGE — example content for the app guide. " +
        "Reminder: photograph every container before you leave the site.",
    });
    if (error) console.warn(`  (could not post announcement: ${error.message})`);
    else console.log("· posted one example announcement");
  }
}

/* -------------------------------------------------- hide acceptance fixtures */

/**
 * The staging project carries leftover E2E acceptance records — "E2E Customer",
 * "E2E-T1", "#E2E-DRIVER" and the matching identities. They are meaningless to
 * an employee reading the guide and make the office screenshots look like a
 * test harness, so they are hidden for the duration of the shoot.
 *
 * This is a soft delete, not a delete: every one of these rows is upserted with
 * `deleted_at: null` by scripts/bootstrap-staging-e2e.mjs, so the next
 * acceptance run in CI restores them automatically. To bring them back by hand,
 * set `deleted_at` to null on the same ids.
 */
const hidden = { customers: 0, trucks: 0, dumpsters: 0, jobs: 0, users: 0 };
const now = new Date().toISOString();
for (const [table, column] of [
  ["jobs", "reference"],
  ["customers", "name"],
  ["trucks", "number"],
  ["dumpsters", "code"],
  ["users", "full_name"],
]) {
  const { data, error } = await service
    .from(table)
    .update({ deleted_at: now })
    .ilike(column, "%E2E%")
    .is("deleted_at", null)
    .select("id");
  if (error) {
    console.warn(`  (could not hide ${table}: ${error.message})`);
    continue;
  }
  hidden[table] = data?.length ?? 0;
}
const hiddenTotal = Object.values(hidden).reduce((a, b) => a + b, 0);
console.log(
  hiddenTotal
    ? `· hid ${hiddenTotal} leftover E2E acceptance records (CI restores them)`
    : "· no E2E acceptance records to hide",
);

console.log(
  `\nStaging is ready. Capture with:\n  GUIDE_DRIVER_EMAIL=${DRIVER.email} npm run docs:guide`,
);
