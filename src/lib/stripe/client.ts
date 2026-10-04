import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;
let verifiedAccount: Promise<string> | null = null;

type StripeMode = "test" | "live";

export function stripeKeyMode(key = process.env.STRIPE_SECRET_KEY): StripeMode | null {
  if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) return "live";
  if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) return "test";
  return null;
}

/**
 * The server-side Stripe client.
 *
 * Refuses a live key outside production on purpose. This repository lives in
 * iCloud Drive, so `.env.local` syncs off the machine, and a live secret key
 * there can move real money. Development runs against test mode; live keys
 * belong in the deployment's own environment and nowhere else.
 */
export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const mode = stripeKeyMode(key);
  if (!mode) throw new Error("STRIPE_SECRET_KEY is not a supported Stripe key.");
  if (mode === "live" && process.env.VERCEL_ENV !== "production") {
    throw new Error(
      "Refusing to use a live Stripe key outside the Vercel production environment.",
    );
  }
  const expected = process.env.STRIPE_EXPECTED_MODE;
  if (expected && expected !== mode)
    throw new Error(`Stripe key mode is ${mode}, but ${expected} was expected.`);
  cached ??= new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return cached;
}

export function stripeInvoicingEnabled() {
  return process.env.STRIPE_INVOICING_ENABLED === "true";
}

/** Verify the key belongs to the configured account before a money action. */
async function assertStripeAccount(stripe = createStripeClient()) {
  const expected = process.env.STRIPE_ACCOUNT_ID;
  if (!expected) throw new Error("STRIPE_ACCOUNT_ID is not configured.");
  verifiedAccount ??= stripe.accounts.retrieveCurrent().then((account) => {
    if (account.id !== expected)
      throw new Error("Stripe key belongs to a different account.");
    return account.id;
  });
  return verifiedAccount;
}

export async function requireStripeInvoicing() {
  if (!stripeInvoicingEnabled())
    throw new Error("Stripe invoicing is disabled for this deployment.");
  const stripe = createStripeClient();
  await assertStripeAccount(stripe);
  return stripe;
}
