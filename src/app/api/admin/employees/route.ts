import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfa } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const access = await requireAdminMfa();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { client } = access;
  const admin = createAdminClient();
  let input:{ employeeId?: string; fullName?: string; email?: string; phone?: string; role?: "dispatcher" | "driver" | "office" | "management"; accessRole?: "admin" | "dispatcher" | "driver" };
  try{input=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  if (!input.employeeId?.trim() || !input.fullName?.trim() || !input.email?.trim() || !input.role || !input.accessRole) return NextResponse.json({ error: "Employee ID, name, email, and roles are required." }, { status: 400 });
  if((input.role==="driver") !== (input.accessRole==="driver") || (input.role==="management"&&input.accessRole!=="admin")) return NextResponse.json({error:"Operational role and access role are incompatible."},{status:400});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
  const initials = input.fullName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  const profile = await admin.from("users").insert({ employee_id: input.employeeId.trim(), full_name: input.fullName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() ?? "", role: input.role, access_role: input.accessRole, initials, status: "active", permission_overrides: {} }).select().single();
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 409 });
  const invite = await admin.auth.admin.inviteUserByEmail(input.email.trim().toLowerCase(), { data: { full_name: input.fullName.trim() } });
  if (invite.error) { await admin.from("users").delete().eq("id", profile.data.id); return NextResponse.json({ error: invite.error.message }, { status: 502 }); }
  await client.rpc("audit_admin_action", { target_user_id: profile.data.id, admin_action: "invite_created" });
  return NextResponse.json({ id: profile.data.id }, { status: 201 });
}
