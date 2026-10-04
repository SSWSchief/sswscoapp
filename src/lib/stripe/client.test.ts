import { afterEach, describe, expect, it } from "vitest";
import { createStripeClient, stripeKeyMode } from "./client";

const original = { key: process.env.STRIPE_SECRET_KEY, mode: process.env.STRIPE_EXPECTED_MODE, vercel: process.env.VERCEL_ENV };
afterEach(() => {
  if (original.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = original.key;
  if (original.mode === undefined) delete process.env.STRIPE_EXPECTED_MODE; else process.env.STRIPE_EXPECTED_MODE = original.mode;
  if (original.vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.vercel;
});

describe("Stripe environment guard", () => {
  it("recognizes standard and restricted test/live keys", () => {
    expect(stripeKeyMode("sk_test_x")).toBe("test"); expect(stripeKeyMode("rk_test_x")).toBe("test");
    expect(stripeKeyMode("sk_live_x")).toBe("live"); expect(stripeKeyMode("rk_live_x")).toBe("live");
  });
  it("refuses live money keys outside Vercel production", () => {
    process.env.STRIPE_SECRET_KEY = "rk_live_example"; delete process.env.VERCEL_ENV;
    expect(() => createStripeClient()).toThrow(/Refusing to use a live Stripe key/);
  });
  it("refuses a key whose mode differs from configuration", () => {
    process.env.STRIPE_SECRET_KEY = "rk_test_example"; process.env.STRIPE_EXPECTED_MODE = "live";
    expect(() => createStripeClient()).toThrow(/test, but live was expected/);
  });
});
