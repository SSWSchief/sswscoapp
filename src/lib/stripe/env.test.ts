import { afterEach, describe, expect, it } from "vitest";
import { stripeConfigurationStatus, webhookSigningSecret } from "./env";

const keys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_ACCOUNT_ID",
  "STRIPE_EXPECTED_MODE",
  "STRIPE_INVOICING_ENABLED",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const configure = (values: Partial<Record<(typeof keys)[number], string>>) => {
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
};

describe("stripeConfigurationStatus", () => {
  it("reports a fully configured test deployment", () => {
    configure({
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_ACCOUNT_ID: "acct_example",
      STRIPE_EXPECTED_MODE: "test",
      STRIPE_INVOICING_ENABLED: "true",
    });
    expect(stripeConfigurationStatus()).toEqual({
      configured: true,
      invoicingEnabled: true,
      secretKey: true,
      webhookSecret: true,
      accountId: true,
      expectedMode: "test",
      mode: "test",
    });
  });

  /**
   * The reason this is reported at all: a deployment that never received its
   * webhook secret rejects every Stripe event as unsigned, which from outside
   * looks exactly like Stripe being broken.
   */
  it("singles out a missing webhook secret without reporting the key itself", () => {
    configure({ STRIPE_SECRET_KEY: "sk_test_example", STRIPE_ACCOUNT_ID: "acct_example" });
    const status = stripeConfigurationStatus();
    expect(status).toMatchObject({ configured: false, secretKey: true, webhookSecret: false });
    expect(JSON.stringify(status)).not.toContain("sk_test_example");
  });

  it("treats the placeholders shipped in .env.example as absent", () => {
    configure({
      STRIPE_SECRET_KEY: "sk_test_your-test-key",
      STRIPE_WEBHOOK_SECRET: "whsec_your-signing-secret",
      STRIPE_ACCOUNT_ID: "acct_your-account-id",
    });
    expect(stripeConfigurationStatus()).toMatchObject({
      configured: false,
      secretKey: false,
      webhookSecret: false,
      accountId: false,
    });
  });

  it("distinguishes live from test keys, including restricted ones", () => {
    configure({ STRIPE_SECRET_KEY: "sk_live_example" });
    expect(stripeConfigurationStatus().mode).toBe("live");
    configure({ STRIPE_SECRET_KEY: "rk_live_example" });
    expect(stripeConfigurationStatus().mode).toBe("live");
    configure({ STRIPE_SECRET_KEY: "rk_test_example" });
    expect(stripeConfigurationStatus().mode).toBe("test");
    configure({ STRIPE_SECRET_KEY: "not-a-stripe-key" });
    expect(stripeConfigurationStatus().mode).toBe("unset");
    configure({});
    expect(stripeConfigurationStatus().mode).toBe("unset");
  });

  it("reports an unrecognized expected mode as unset rather than guessing", () => {
    configure({ STRIPE_EXPECTED_MODE: "sandbox" });
    expect(stripeConfigurationStatus().expectedMode).toBe("unset");
  });

  it("only counts sending as enabled on an exact opt-in", () => {
    for (const value of ["false", "TRUE", "1", "yes"]) {
      configure({ STRIPE_INVOICING_ENABLED: value });
      expect(stripeConfigurationStatus().invoicingEnabled).toBe(false);
    }
    configure({ STRIPE_INVOICING_ENABLED: "true" });
    expect(stripeConfigurationStatus().invoicingEnabled).toBe(true);
  });
});

describe("webhookSigningSecret", () => {
  it("returns a real secret and null for a placeholder or missing one", () => {
    configure({ STRIPE_WEBHOOK_SECRET: "whsec_real" });
    expect(webhookSigningSecret()).toBe("whsec_real");
    configure({ STRIPE_WEBHOOK_SECRET: "whsec_placeholder_for_now" });
    expect(webhookSigningSecret()).toBeNull();
    configure({});
    expect(webhookSigningSecret()).toBeNull();
  });
});
