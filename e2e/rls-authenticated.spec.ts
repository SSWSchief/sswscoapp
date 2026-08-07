import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const available = Boolean(
  url &&
    key &&
    process.env.E2E_ADMIN_EMAIL &&
    process.env.E2E_DISPATCHER_EMAIL &&
    process.env.E2E_DRIVER_EMAIL &&
    process.env.E2E_INACTIVE_EMAIL &&
    process.env.E2E_REDUCED_EMAIL,
);
const client = () =>
  createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function login(db: SupabaseClient, email: string, password: string) {
  const result = await db.auth.signInWithPassword({ email, password });
  expect(result.error).toBeNull();
}

test.describe("authenticated RLS boundaries", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium" || !available,
    "Runs once with bootstrapped staging identities",
  );

  test("administrator permissions work at AAL1 while MFA is disabled", async () => {
    const db = client();
    await login(
      db,
      process.env.E2E_ADMIN_EMAIL!,
      process.env.E2E_ADMIN_PASSWORD!,
    );
    const permission = await db.rpc("has_permission", {
      permission_key: "management",
    });
    expect(permission.data).toBe(true);
    const saved = await db.rpc("save_company_settings", {
      company_name: "Silver State Waste Solutions",
      company_address: "100 Test Way",
      company_phone: "555-0100",
      company_email: "dispatch@example.invalid",
      company_time_zone: "America/Los_Angeles",
      company_date_format: "MM/DD/YYYY",
      retention_days: 365,
      invoice_prefix: "E2E",
    });
    expect(saved.error).toBeNull();
    expect(saved.data?.invoice_prefix).toBe("E2E");
    const direct = await db
      .from("company_settings")
      .update({ company_name: "Direct Hack" })
      .eq("id", true)
      .select();
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
  });

  test("driver is isolated to own operational records", async () => {
    const db = client();
    await login(
      db,
      process.env.E2E_DRIVER_EMAIL!,
      process.env.E2E_DRIVER_PASSWORD!,
    );
    const jobs = await db
      .from("jobs")
      .select("id")
      .like("id", "e2e-%")
      .order("id");
    expect(jobs.error).toBeNull();
    expect(jobs.data?.map((row) => row.id)).toEqual(["e2e-driver-job"]);
    const customers = await db
      .from("customers")
      .select("id")
      .like("id", "e2e-%")
      .order("id");
    expect(customers.data?.map((row) => row.id)).toEqual(["e2e-customer"]);
    const users = await db
      .from("users")
      .select("employee_id")
      .like("employee_id", "E2E-%");
    expect(users.data?.map((row) => row.employee_id)).toEqual(["E2E-DRIVER"]);
    const directJob = await db.from("jobs").insert({
      id: "e2e-forbidden-job",
      reference: "#E2E-FORBIDDEN",
      customer_id: "e2e-customer",
      address: "Denied",
      service_type: "Delivery",
      dumpster_size: "20 Yard",
      scheduled_for: new Date().toISOString(),
      status: "pending",
    });
    expect(directJob.error).toBeTruthy();
    const directTime = await db.from("time_entries").insert({
      user_id: "e2e-driver",
      entry_type: "clock_in",
      occurred_at: new Date().toISOString(),
    });
    expect(directTime.error).toBeTruthy();
  });

  test("dispatcher defaults work and reduced overrides are enforced", async () => {
    const dispatcher = client();
    await login(
      dispatcher,
      process.env.E2E_DISPATCHER_EMAIL!,
      process.env.E2E_DISPATCHER_PASSWORD!,
    );
    const visible = await dispatcher
      .from("customers")
      .select("id")
      .like("id", "e2e-%");
    expect(visible.data).toHaveLength(2);
    const reduced = client();
    await login(
      reduced,
      process.env.E2E_REDUCED_EMAIL!,
      process.env.E2E_REDUCED_PASSWORD!,
    );
    const customerPermission = await reduced.rpc("has_permission", {
      permission_key: "customers",
    });
    expect(customerPermission.data).toBe(false);
    const hiddenCustomers = await reduced
      .from("customers")
      .select("id")
      .like("id", "e2e-%");
    expect(hiddenCustomers.data).toEqual([]);
    const hiddenJobs = await reduced
      .from("jobs")
      .select("id")
      .like("id", "e2e-%");
    expect(hiddenJobs.data).toEqual([]);
    const forbiddenRpc = await reduced.rpc("create_job", {
      customer_id: "e2e-customer",
      job_address: "Denied",
      job_phone: "",
      service: "Delivery",
      container_size: "20 Yard",
      driver_id: null,
      truck_id: null,
      dumpster_id: null,
      schedule_at: new Date().toISOString(),
      job_notes: "",
      traffic: "",
    });
    expect(forbiddenRpc.error).toBeTruthy();
  });

  test("inactive profile cannot resolve an application identity", async () => {
    const db = client();
    await login(
      db,
      process.env.E2E_INACTIVE_EMAIL!,
      process.env.E2E_INACTIVE_PASSWORD!,
    );
    const identity = await db.rpc("current_app_user_id");
    expect(identity.data).toBeNull();
    const jobs = await db.from("jobs").select("id").like("id", "e2e-%");
    expect(jobs.data).toEqual([]);
    const settings = await db.from("company_settings").select("id");
    expect(settings.data).toEqual([]);
    const sops = await db.from("sop_documents").select("id");
    expect(sops.data).toEqual([]);
    const checklists = await db.from("pretrip_templates").select("id");
    expect(checklists.data).toEqual([]);
  });
});
