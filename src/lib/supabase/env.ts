const placeholderValues = new Set(["", "your-project-url", "your-publishable-key", "your-secret-key"]);

function requiredPublic(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value || placeholderValues.has(value)) throw new Error(`${name} is not configured.`);
  return value;
}

export function getSupabasePublicEnv() {
  const url = requiredPublic("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredPublic("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  try { new URL(url); } catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."); }
  if (!publishableKey.startsWith("sb_publishable_")) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is invalid.");
  return { url, publishableKey };
}
