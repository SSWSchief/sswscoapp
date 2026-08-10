import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  driverPrimaryNav,
  driverSecondaryNav,
  staffNavItems,
} from "@/components/navigation/routes";

const protectedPrefixes = ["/dispatcher", "/driver", "/management"];
type Profile = {
  access_role: "admin" | "dispatcher" | "driver";
  permission_overrides: Record<string, boolean> | null;
};
const driverNavItems = [...driverPrimaryNav, ...driverSecondaryNav];
const routePermissions = [...staffNavItems, ...driverNavItems].map((item) => ({
  prefix: item.href,
  key: item.permission,
}));
const fallbackRoutes = {
  admin: [...staffNavItems]
    .sort((left, right) =>
      left.href === "/management" ? -1 : right.href === "/management" ? 1 : 0,
    )
    .map((item) => ({ path: item.href, key: item.permission })),
  driver: driverNavItems.map((item) => ({
    path: item.href,
    key: item.permission,
  })),
  staff: staffNavItems
    .filter((item) => !item.href.startsWith("/management"))
    .map((item) => ({ path: item.href, key: item.permission })),
};

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function contentSecurityPolicy(nonce: string, supabaseUrl: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseUrl}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} wss://*.supabase.co`,
    `media-src 'self' blob: ${supabaseUrl}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
  const csp = contentSecurityPolicy(nonce, supabaseUrl);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the request CSP to attach the nonce to framework scripts.
  requestHeaders.set("Content-Security-Policy", csp);
  const secured = <T extends NextResponse>(result: T): T => {
    result.headers.set("Content-Security-Policy", csp);
    return result;
  };
  let response = secured(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  const isEntry = request.nextUrl.pathname === "/";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return isProtected
      ? secured(
          new NextResponse("Authentication is not configured.", {
            status: 503,
          }),
        )
      : response;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = secured(
          NextResponse.next({ request: { headers: requestHeaders } }),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const permittedDestination = async (profile: Profile) => {
    const routes =
      profile.access_role === "driver"
        ? fallbackRoutes.driver
        : profile.access_role === "admin"
          ? fallbackRoutes.admin
          : fallbackRoutes.staff;
    for (const route of routes) {
      const result = await supabase.rpc("has_permission", {
        permission_key: route.key,
      });
      if (result.data === true) return route.path;
    }
    return null;
  };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && (isProtected || isEntry)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    if (isProtected) login.searchParams.set("next", request.nextUrl.pathname);
    return secured(NextResponse.redirect(login));
  }

  let profile: Profile | null = null;
  if (
    user &&
    (isProtected || isEntry || request.nextUrl.pathname === "/login")
  ) {
    const result = await supabase
      .from("users")
      .select("access_role,permission_overrides")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    profile = result.data as Profile | null;
  }
  if (user && isEntry) {
    const destination = request.nextUrl.clone();
    destination.pathname = profile
      ? ((await permittedDestination(profile)) ?? "/login")
      : "/login";
    destination.search = "";
    return secured(NextResponse.redirect(destination));
  }
  if (user && isProtected) {
    const path = request.nextUrl.pathname;
    const baseAllowed =
      profile &&
      ((path.startsWith("/driver") && profile.access_role === "driver") ||
        (path.startsWith("/dispatcher") && profile.access_role !== "driver") ||
        (path.startsWith("/management") && profile.access_role === "admin"));
    const permission = routePermissions.find((route) =>
      path.startsWith(route.prefix),
    );
    let permissionAllowed = true;
    if (profile && permission) {
      const result = await supabase.rpc("has_permission", {
        permission_key: permission.key,
      });
      permissionAllowed = result.data === true;
    }
    const allowed = baseAllowed && permissionAllowed;
    if (!allowed) {
      const destination = request.nextUrl.clone();
      destination.pathname = profile
        ? ((await permittedDestination(profile)) ?? "/login")
        : "/login";
      destination.search = "";
      if (destination.pathname === path) destination.pathname = "/login";
      return secured(NextResponse.redirect(destination));
    }
  }
  if (user && request.nextUrl.pathname === "/login" && profile) {
    const destination = request.nextUrl.clone();
    const requested = safeInternalPath(
      request.nextUrl.searchParams.get("next"),
    );
    const allowedFallback = await permittedDestination(profile);
    if (!allowedFallback) return response;
    destination.pathname = requested ?? allowedFallback;
    destination.search = "";
    return secured(NextResponse.redirect(destination));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|brand|favicon.ico|sw.js).*)"],
};
