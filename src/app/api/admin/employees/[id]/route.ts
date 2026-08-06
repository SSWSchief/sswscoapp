import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await client.from("users").select("id,access_role").eq("auth_user_id", auth.data.user.id).eq("status", "active").is("deleted_at", null).maybeSingle();
  if (actor.data?.access_role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const input = await request.json() as { status?: "active" | "inactive"; accessRole?: "admin" | "dispatcher" | "driver" };
  const changes: Record<string, unknown> = {};
  if (input.status) changes.status = input.status;
  if (input.accessRole) { changes.access_role = input.accessRole; changes.permission_overrides = {}; }
  if (!Object.keys(changes).length) return NextResponse.json({ error: "No supported changes supplied" }, { status: 400 });
  const existing = await client.from("users").select("id,access_role,auth_user_id").eq("id", id).maybeSingle();
  if (!existing.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const demotesAdmin = existing.data.access_role === "admin" && input.accessRole && input.accessRole !== "admin";
  const deactivatesAdmin = existing.data.access_role === "admin" && input.status === "inactive";
  if (demotesAdmin || deactivatesAdmin) {
    const admins = await client.from("users").select("id").eq("access_role", "admin").eq("status", "active").is("deleted_at", null);
    if ((admins.data?.length ?? 0) <= 1) return NextResponse.json({ error: "At least one active admin is required." }, { status: 400 });
  }
  const result = await client.from("users").update(changes).eq("id", id).select().single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  if (existing.data.auth_user_id && input.status) {
    const admin = createAdminClient();
    const banDuration = input.status === "inactive" ? "876000h" : "none";
    const authUpdate = await admin.auth.admin.updateUserById(existing.data.auth_user_id, { ban_duration: banDuration } as never);
    if (authUpdate.error) return NextResponse.json({ error: authUpdate.error.message }, { status: 502 });
  }
  await client.rpc("audit_admin_action", { target_user_id: id, admin_action: input.status ? `status_${input.status}` : "access_role_changed" });
  return NextResponse.json({ id: result.data.id });
}
