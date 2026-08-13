import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailDeliveryEnabled,
  passwordRecoveryGuidance,
} from "./email-delivery";

afterEach(() => vi.unstubAllEnvs());

describe("emailDeliveryEnabled", () => {
  it("is off when the variable is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "");
    expect(emailDeliveryEnabled()).toBe(false);
  });
  it("is on only for the exact string true", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    expect(emailDeliveryEnabled()).toBe(true);
  });
  it("treats other truthy-looking values as off", () => {
    for (const value of ["1", "yes", "TRUE", "on"]) {
      vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", value);
      expect(emailDeliveryEnabled()).toBe(false);
    }
  });
});

describe("passwordRecoveryGuidance", () => {
  it("never claims an email was sent when delivery is off", () => {
    const guidance = passwordRecoveryGuidance(false);
    expect(guidance).not.toMatch(/sent/i);
    expect(guidance).toMatch(/administrator/i);
    expect(guidance).toMatch(/temporary password/i);
  });
  it("keeps the neutral confirmation when delivery is on", () => {
    expect(passwordRecoveryGuidance(true)).toMatch(/sent/i);
  });
  it("follows the environment when no argument is given", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "true");
    expect(passwordRecoveryGuidance()).toBe(passwordRecoveryGuidance(true));
    vi.stubEnv("NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED", "false");
    expect(passwordRecoveryGuidance()).toBe(passwordRecoveryGuidance(false));
  });
});
