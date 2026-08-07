import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { permissionKeys } from "@/lib/permissions";
import { isOwnerEmail } from "@/lib/owners";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { client } = access;
  const admin = createAdminClient();
  const { id } = await params;
  let input:{ status?: "active" | "inactive"; accessRole?: "admin" | "dispatcher" | "driver"; permissionOverrides?: Record<string,boolean> };
  try{input=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  const changes: Record<string, unknown> = {};
  if (input.status) changes.status = input.status;
  if (input.accessRole) { changes.access_role = input.accessRole; changes.permission_overrides = {}; }
  if (input.permissionOverrides) {
    if (Object.entries(input.permissionOverrides).some(([key,value])=>!permissionKeys.includes(key as never)||typeof value!=="boolean")) return NextResponse.json({error:"Permission overrides are invalid."},{status:400});
    changes.permission_overrides = input.permissionOverrides;
  }
  if (!Object.keys(changes).length) return NextResponse.json({ error: "No supported changes supplied" }, { status: 400 });
  const existing = await admin.from("users").select("id,email,role,status,access_role,auth_user_id").eq("id", id).maybeSingle();
  if (!existing.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (isOwnerEmail(existing.data.email)) {
    const ownerAccessChange = (input.accessRole && input.accessRole !== "admin") || input.status === "inactive" || Boolean(input.permissionOverrides && Object.keys(input.permissionOverrides).length);
    if (ownerAccessChange) return NextResponse.json({ error: "Owner profiles must retain active full administrator access." }, { status: 400 });
  }
  const demotesAdmin = existing.data.access_role === "admin" && input.accessRole && input.accessRole !== "admin";
  const deactivatesAdmin = existing.data.access_role === "admin" && input.status === "inactive";
  if (demotesAdmin || deactivatesAdmin) {
    const admins = await admin.from("users").select("id").eq("access_role", "admin").eq("status", "active").is("deleted_at", null);
    if ((admins.data?.length ?? 0) <= 1) return NextResponse.json({ error: "At least one active admin is required." }, { status: 400 });
  }
  if(input.accessRole==="driver")changes.role="driver";else if(existing.data.role==="driver"&&input.accessRole)changes.role="dispatcher";
  let authChanged=false;
  if (existing.data.auth_user_id && input.status) {
    const banDuration = input.status === "inactive" ? "876000h" : "none";
    const authUpdate = await admin.auth.admin.updateUserById(existing.data.auth_user_id, { ban_duration: banDuration } as never);
    if (authUpdate.error) return NextResponse.json({ error: authUpdate.error.message }, { status: 502 });
    authChanged=true;
  }
  const result = await admin.from("users").update(changes).eq("id", id).select().single();
  if (result.error) {if(authChanged&&existing.data.auth_user_id){const rollback=existing.data.status==="inactive"?"876000h":"none";await createAdminClient().auth.admin.updateUserById(existing.data.auth_user_id,{ban_duration:rollback} as never);}return NextResponse.json({ error: result.error.message }, { status: 400 });}
  await client.rpc("audit_admin_action", { target_user_id: id, admin_action: input.status ? `status_${input.status}` : input.accessRole ? "access_role_changed" : "permissions_changed" });
  return NextResponse.json({ id: result.data.id });
}
