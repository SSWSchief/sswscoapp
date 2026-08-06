import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (!auth.data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await client.from("users").select("access_role").eq("auth_user_id", auth.data.user.id).eq("status", "active").maybeSingle();
  if (actor.data?.access_role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const input = await request.json() as { status?: "active" | "inactive"; accessRole?: "admin" | "dispatcher" | "driver" };
  const changes: Record<string, unknown> = {};
  if (input.status) changes.status = input.status;
  if (input.accessRole) { changes.access_role = input.accessRole; changes.permission_overrides = {}; }
  if (!Object.keys(changes).length) return NextResponse.json({ error: "No supported changes supplied" }, { status: 400 });
  const result = await client.from("users").update(changes).eq("id", id).select().single();
  return result.error ? NextResponse.json({ error: result.error.message }, { status: 400 }) : NextResponse.json({ id: result.data.id });
}
