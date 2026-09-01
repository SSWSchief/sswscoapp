import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

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
  if (key.startsWith("sk_live_") && process.env.NODE_ENV !== "production") {
    throw new Error(
      "Refusing to use a live Stripe key outside production. Use a test key (sk_test_ or rk_test_) locally.",
    );
  }
  cached ??= new Stripe(key);
  return cached;
}
