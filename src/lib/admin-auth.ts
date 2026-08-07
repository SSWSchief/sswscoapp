import { createClient } from "@/lib/supabase/server";

export async function requireAdminMfa() {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return { client, error: "Unauthorized", status: 401 as const };
  const actor = await client
    .from("users")
    .select("id,access_role")
    .eq("auth_user_id", auth.data.user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (actor.data?.access_role !== "admin") return { client, error: "Admin access required", status: 403 as const };
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel !== "aal2") return { client, error: "Administrator MFA verification required", status: 403 as const };
  return { client, actor: actor.data, status: 200 as const };
}
