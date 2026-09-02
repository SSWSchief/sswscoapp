import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  landingRoutes,
  portalAllowsRole,
  routePermissionFor,
} from "@/lib/portal-access";

const protectedPrefixes = ["/dispatcher", "/driver", "/management"];
type Profile = {
  access_role: "admin" | "dispatcher" | "driver";
  permission_overrides: Record<string, boolean> | null;
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

  // A production build prefetches every visible link, so opening one page fired
  // nine concurrent middleware invocations, each running a full Supabase auth
  // pass. @supabase/ssr rotates the refresh token when it refreshes, and those
  // parallel rotations invalidate one another — leaving the browser holding a
  // cookie that no longer authenticates, after which every query returns
  // nothing and the app looks empty rather than broken.
  //
  // Prefetches are answered without touching auth. Nothing is weakened by it:
  // no page content is produced, and the real navigation still runs every
  // check below. The only cost is that protected routes are no longer
  // prefetched, which trades a little navigation speed for a session that
  // survives a page load. Local development never showed this because Next
  // does not prefetch in dev, and a single Node process does not run the
  // invocations in parallel the way Vercel's edge does.
  if (request.headers.get("next-router-prefetch") === "1")
    return secured(new NextResponse(null, { status: 204 }));
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
    for (const route of landingRoutes(profile.access_role)) {
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
    const baseAllowed = profile && portalAllowsRole(path, profile.access_role);
    const permission = routePermissionFor(path);
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
