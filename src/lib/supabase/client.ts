import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  browserClient ??= createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
