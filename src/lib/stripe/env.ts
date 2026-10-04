const placeholderValues = new Set([
  "",
  "sk_test_your-test-key",
  "sk_test_replace_with_a_TEST_mode_key",
  "whsec_your-signing-secret",
  "whsec_placeholder_for_now",
  "acct_your-account-id",
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
  const accountId = present(process.env.STRIPE_ACCOUNT_ID);
  const expectedMode = process.env.STRIPE_EXPECTED_MODE;
  const key = process.env.STRIPE_SECRET_KEY;
  const mode = key?.startsWith("sk_live_") || key?.startsWith("rk_live_")
    ? "live"
    : key?.startsWith("sk_test_") || key?.startsWith("rk_test_")
      ? "test"
      : "unset";
  return {
    configured: secretKey && webhookSecret && accountId,
    invoicingEnabled: process.env.STRIPE_INVOICING_ENABLED === "true",
    secretKey,
    webhookSecret,
    accountId,
    expectedMode: expectedMode === "live" || expectedMode === "test"
      ? expectedMode
      : "unset",
    // Which Stripe environment the key addresses, so test and live keys are
    // never confused for one another from the outside.
    mode,
  };
}

/** The webhook signing secret, or null when this deployment never received one. */
export function webhookSigningSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  return present(value) ? (value as string) : null;
}
