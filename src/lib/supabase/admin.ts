import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";
import type { Database } from "./database.types";

export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !secret.startsWith("sb_secret_"))
    throw new Error("SUPABASE_SECRET_KEY is not configured.");
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
