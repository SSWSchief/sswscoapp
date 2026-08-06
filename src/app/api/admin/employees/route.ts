import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await client.from("users").select("access_role").eq("auth_user_id", auth.data.user.id).eq("status", "active").maybeSingle();
  if (actor.data?.access_role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const input = await request.json() as { employeeId?: string; fullName?: string; email?: string; phone?: string; role?: "dispatcher" | "driver" | "office" | "management"; accessRole?: "admin" | "dispatcher" | "driver" };
  if (!input.employeeId?.trim() || !input.fullName?.trim() || !input.email?.trim() || !input.role || !input.accessRole) return NextResponse.json({ error: "Employee ID, name, email, and roles are required." }, { status: 400 });
  const initials = input.fullName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  const profile = await client.from("users").insert({ employee_id: input.employeeId.trim(), full_name: input.fullName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() ?? "", role: input.role, access_role: input.accessRole, initials, status: "active", permission_overrides: {} }).select().single();
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 409 });
  const invite = await createAdminClient().auth.admin.inviteUserByEmail(input.email.trim().toLowerCase(), { data: { full_name: input.fullName.trim() } });
  if (invite.error) { await client.from("users").delete().eq("id", profile.data.id); return NextResponse.json({ error: invite.error.message }, { status: 502 }); }
  await client.rpc("audit_admin_action", { target_user_id: profile.data.id, admin_action: "invite_created" });
  return NextResponse.json({ id: profile.data.id }, { status: 201 });
}
