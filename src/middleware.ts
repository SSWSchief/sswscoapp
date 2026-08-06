import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const protectedPrefixes = ["/dispatcher", "/driver", "/management"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isProtected = protectedPrefixes.some(prefix => request.nextUrl.pathname.startsWith(prefix));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return isProtected ? new NextResponse("Authentication is not configured.", { status: 503 }) : response;

  const supabase = createServerClient<Database>(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && isProtected) { const login = request.nextUrl.clone(); login.pathname = "/login"; login.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(login); }

  let profile: { access_role: "admin" | "dispatcher" | "driver" } | null = null;
  if (user && (isProtected || request.nextUrl.pathname === "/login")) { const result = await supabase.from("users").select("access_role").eq("auth_user_id", user.id).eq("status", "active").maybeSingle(); profile = result.data; }
  if (user && isProtected) {
    const path = request.nextUrl.pathname;
    const allowed = profile && ((path.startsWith("/driver") && profile.access_role === "driver") || (path.startsWith("/dispatcher") && profile.access_role !== "driver") || (path.startsWith("/management") && profile.access_role === "admin"));
    if (!allowed) { const destination = request.nextUrl.clone(); destination.pathname = profile?.access_role === "driver" ? "/driver/jobs" : profile ? "/dispatcher/dashboard" : "/login"; destination.search = ""; return NextResponse.redirect(destination); }
  }
  if (user && request.nextUrl.pathname === "/login") { const destination = request.nextUrl.clone(); destination.pathname = profile?.access_role === "driver" ? "/driver/jobs" : "/dispatcher/dashboard"; destination.search = ""; return NextResponse.redirect(destination); }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icons|brand|favicon.ico|sw.js|offline).*)"] };
