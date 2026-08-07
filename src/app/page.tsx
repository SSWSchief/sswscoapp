import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("access_role")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.access_role === "driver") redirect("/driver/jobs");
  if (profile.access_role === "admin") redirect("/management");
  redirect("/dispatcher/dashboard");
}
