import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function invoiceSession() {
  const db = await createClient();
  const auth = await db.auth.getUser();
  if (!auth.data.user) return { ok: false as const, reason: "unauthorized" };
  const permission = await db.rpc("has_permission", {
    permission_key: "invoices",
  });
  if (permission.error || permission.data !== true)
    return { ok: false as const, reason: "forbidden" };
  return { ok: true as const, db, user: auth.data.user };
}
