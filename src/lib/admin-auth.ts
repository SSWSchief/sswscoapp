import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminAccess =
  | { ok: false; client: ServerClient; error: string; status: 401 | 403 }
  | {
      ok: true;
      client: ServerClient;
      actor: { id: string; access_role: "admin" };
      status: 200;
    };

export async function requireAdmin(): Promise<AdminAccess> {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user)
    return { ok: false, client, error: "Unauthorized", status: 401 };
  const actor = await client
    .from("users")
    .select("id,access_role")
    .eq("auth_user_id", auth.data.user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (actor.data?.access_role !== "admin")
    return { ok: false, client, error: "Admin access required", status: 403 };
  return {
    ok: true,
    client,
    actor: { id: actor.data.id, access_role: "admin" },
    status: 200,
  };
}
