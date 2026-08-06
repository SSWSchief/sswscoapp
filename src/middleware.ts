import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const protectedPrefixes = ["/dispatcher", "/driver", "/management"];
type Profile = { access_role: "admin" | "dispatcher" | "driver"; permission_overrides: Record<string, boolean> | null };
const routePermissions: Array<{ prefix: string; key: string }> = [
  { prefix: "/management", key: "management" },
  { prefix: "/dispatcher/dashboard", key: "dashboard" },
  { prefix: "/dispatcher/jobs", key: "jobs" },
  { prefix: "/dispatcher/customers", key: "customers" },
  { prefix: "/dispatcher/trucks", key: "trucks" },
  { prefix: "/dispatcher/dumpsters", key: "dumpsters" },
  { prefix: "/dispatcher/employees", key: "employees" },
  { prefix: "/dispatcher/time-clock", key: "time_clock" },
  { prefix: "/dispatcher/absence-calendar", key: "absence" },
  { prefix: "/driver/jobs", key: "driver_jobs" },
  { prefix: "/driver/time-clock", key: "time_clock" },
  { prefix: "/driver/profile", key: "profile" },
];
const fallbackRoutes = {
  driver: [
    { path: "/driver/jobs", key: "driver_jobs" },
    { path: "/driver/time-clock", key: "time_clock" },
    { path: "/driver/profile", key: "profile" },
  ],
  staff: [
    { path: "/dispatcher/dashboard", key: "dashboard" },
    { path: "/dispatcher/jobs", key: "jobs" },
    { path: "/dispatcher/customers", key: "customers" },
    { path: "/dispatcher/trucks", key: "trucks" },
    { path: "/dispatcher/dumpsters", key: "dumpsters" },
    { path: "/dispatcher/time-clock", key: "time_clock" },
  ],
};

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isProtected = protectedPrefixes.some(prefix => request.nextUrl.pathname.startsWith(prefix));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return isProtected ? new NextResponse("Authentication is not configured.", { status: 503 }) : response;

  const supabase = createServerClient<Database>(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const permittedDestination = async (profile: Profile) => {
    const routes = profile.access_role === "driver" ? fallbackRoutes.driver : fallbackRoutes.staff;
    for (const route of routes) {
      const result = await supabase.rpc("has_permission", { permission_key: route.key });
      if (result.data === true) return route.path;
    }
    return null;
  };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && isProtected) { const login = request.nextUrl.clone(); login.pathname = "/login"; login.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(login); }

  let profile: Profile | null = null;
  if (user && (isProtected || request.nextUrl.pathname === "/login")) { const result = await supabase.from("users").select("access_role,permission_overrides").eq("auth_user_id", user.id).eq("status", "active").is("deleted_at", null).maybeSingle(); profile = result.data as Profile | null; }
  if (user && isProtected) {
    const path = request.nextUrl.pathname;
    const baseAllowed = profile && ((path.startsWith("/driver") && profile.access_role === "driver") || (path.startsWith("/dispatcher") && profile.access_role !== "driver") || (path.startsWith("/management") && profile.access_role === "admin"));
    const permission = routePermissions.find(route => path.startsWith(route.prefix));
    let permissionAllowed = true;
    if (profile && permission) {
      const result = await supabase.rpc("has_permission", { permission_key: permission.key });
      permissionAllowed = result.data === true;
    }
    const allowed = baseAllowed && permissionAllowed;
    if (!allowed) { const destination = request.nextUrl.clone(); destination.pathname = profile ? await permittedDestination(profile) ?? "/login" : "/login"; destination.search = ""; if (destination.pathname === path) destination.pathname = "/login"; return NextResponse.redirect(destination); }
  }
  if (user && request.nextUrl.pathname === "/login" && profile) { const allowedFallback = await permittedDestination(profile); if (!allowedFallback) return response; const destination = request.nextUrl.clone(); destination.pathname = safeInternalPath(request.nextUrl.searchParams.get("next")) ?? allowedFallback; destination.search = ""; return NextResponse.redirect(destination); }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icons|brand|favicon.ico|sw.js|offline).*)"] };
