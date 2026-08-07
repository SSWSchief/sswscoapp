import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { client } = access;
  const { id } = await params;
  const admin = createAdminClient();
  const profile = await admin.from("users").select("email").eq("id", id).maybeSingle();
  if (!profile.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const result = await admin.auth.resetPasswordForEmail(profile.data.email, { redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password` });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 502 });
  await client.rpc("audit_admin_action", { target_user_id: id, admin_action: "password_reset_initiated" });
  return NextResponse.json({ ok: true });
}
