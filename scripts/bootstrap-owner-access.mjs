import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const rawValue = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
    process.env[key] ??= rawValue;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const password = process.env.OWNER_TEST_PASSWORD ?? "password";

if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");

const owners = [
  {
    id: "owner-austin-marshall",
    employeeId: "OWNER-AMARSHALL",
    fullName: "Austin Marshall",
    email: "amarshall@sswsco.com",
    initials: "AM",
  },
  {
    id: "owner-tehron-porter",
    employeeId: "OWNER-TPORTER",
    fullName: "Tehron Porter",
    email: "tehronporter@gmail.com",
    initials: "TP",
  },
];

const service = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (result.data.users.length < 1000) return null;
  }
  throw new Error("Too many Auth users to scan safely.");
}

for (const owner of owners) {
  let authUser = await findAuthUserByEmail(owner.email);
  if (authUser) {
    const updated = await service.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      ban_duration: "none",
      user_metadata: { full_name: owner.fullName },
    });
    if (updated.error) throw new Error(`${owner.email}: ${updated.error.message}`);
    authUser = updated.data.user;
  } else {
    const created = await service.auth.admin.createUser({
      email: owner.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: owner.fullName },
    });
    if (created.error) throw new Error(`${owner.email}: ${created.error.message}`);
    authUser = created.data.user;
  }

  const existingProfile = await service.from("users").select("id").eq("email", owner.email.toLowerCase()).maybeSingle();
  if (existingProfile.error) throw new Error(`${owner.email}: ${existingProfile.error.message}`);

  const profilePayload = {
      auth_user_id: authUser.id,
      employee_id: owner.employeeId,
      full_name: owner.fullName,
      email: owner.email.toLowerCase(),
      phone: "",
      role: "management",
      access_role: "admin",
      permission_overrides: {},
      status: "active",
      initials: owner.initials,
      deleted_at: null,
  };

  const profile = existingProfile.data
    ? await service
      .from("users")
      .update(profilePayload)
      .eq("id", existingProfile.data.id)
      .select("id,email,access_role,status")
      .single()
    : await service
      .from("users")
      .insert({ id: owner.id, ...profilePayload })
    .select("id,email,access_role,status")
    .single();
  if (profile.error) throw new Error(`${owner.email}: ${profile.error.message}`);

  console.log(JSON.stringify({ email: owner.email, profileId: profile.data.id, authUserId: authUser.id, status: "ready" }));
}
