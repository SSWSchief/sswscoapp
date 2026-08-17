/**
 * Shared plumbing for the two guide scripts.
 *
 * Both need the same three things: the staging credentials out of `.env.local`,
 * a hard refusal to touch production, and a way to open an authenticated
 * browser session without anybody typing a password.
 *
 * That last one is the point of this file. `generateLink` mints a single-use
 * token server-side and sends no email — the same admin API
 * `scripts/check-auth-redirect.mjs` already relies on. Handing that token to
 * `/auth/confirm` gives a real cookie session for the account, so the capture
 * run needs no employee password at all and none can leak into the repository.
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** The client's live project. Nothing here may ever run against it. */
const PRODUCTION_REF = "doofdntdobpixqmcqfnm";

export function loadEnvironment() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
      process.env[key] ??= value;
    }
  }

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const ref = new URL(url).hostname.split(".")[0];
  if (ref === PRODUCTION_REF)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL points at the production project. " +
        "The guide is built from training records on staging only.",
    );
  return {
    url,
    ref,
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    secretKey: required("SUPABASE_SECRET_KEY"),
  };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (expected in .env.local)`);
  return value;
}

export function serviceClient({ url, secretKey }) {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A single-use `/auth/confirm` URL that signs the browser in as `email`.
 * Navigating to it is the whole login: the route exchanges the token for a
 * cookie session and redirects to `next`.
 */
export async function signInUrl(service, email, baseUrl, next = "/") {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw new Error(`Could not mint a link for ${email}: ${error.message}`);
  const token = data.properties?.hashed_token;
  if (!token) throw new Error(`No token returned for ${email}`);
  const url = new URL("/auth/confirm", baseUrl);
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", next);
  return url.toString();
}

/**
 * An authenticated Node client for `email`, used to call the RPCs that check
 * `admin_mfa_verified()` and therefore refuse a bare service-role connection.
 */
export async function authenticatedClient(service, config, email) {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw new Error(`Could not mint a link for ${email}: ${error.message}`);
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error)
    throw new Error(`Could not open a session for ${email}: ${verified.error.message}`);
  return client;
}
