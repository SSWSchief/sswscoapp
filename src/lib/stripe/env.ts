const placeholderValues = new Set([
  "",
  "sk_test_your-test-key",
  "sk_test_replace_with_a_TEST_mode_key",
  "whsec_your-signing-secret",
  "whsec_placeholder_for_now",
]);

const present = (value: string | undefined) =>
  Boolean(value) && !placeholderValues.has(value as string);

/**
 * Which half of the Stripe configuration is present, as booleans — never the
 * keys. Follows the push status for the same reason: a deployment that never
 * received its webhook secret rejects every event as unsigned, which is
 * indistinguishable from Stripe misbehaving unless it can be read from
 * outside in one request.
 */
export function stripeConfigurationStatus() {
  const secretKey = present(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = present(process.env.STRIPE_WEBHOOK_SECRET);
  return {
    configured: secretKey && webhookSecret,
    secretKey,
    webhookSecret,
    // Which Stripe environment the key addresses, so test and live keys are
    // never confused for one another from the outside.
    mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
      ? "live"
      : secretKey
        ? "test"
        : "unset",
  };
}

/** The webhook signing secret, or null when this deployment never received one. */
export function webhookSigningSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  return present(value) ? (value as string) : null;
}
