import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await client.from("users").select("access_role").eq("auth_user_id", auth.data.user.id).eq("status", "active").maybeSingle();
  if (actor.data?.access_role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const profile = await admin.from("users").select("email").eq("id", id).maybeSingle();
  if (!profile.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const result = await admin.auth.resetPasswordForEmail(profile.data.email, { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password` });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 502 });
  await client.rpc("audit_admin_action", { target_user_id: id, admin_action: "password_reset_initiated" });
  return NextResponse.json({ ok: true });
}
