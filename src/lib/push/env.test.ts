import { afterEach, describe, expect, it, vi } from "vitest";
import { pushConfigurationStatus } from "./env";

describe("pushConfigurationStatus", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports a fully configured deployment", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BEbBpublickey");
    vi.stubEnv("VAPID_PRIVATE_KEY", "privatekey");
    vi.stubEnv("VAPID_SUBJECT", "mailto:dispatch@sswsco.com");
    expect(pushConfigurationStatus()).toEqual({
      configured: true,
      publicKey: true,
      privateKey: true,
      subject: true,
    });
  });

  // The failure that made push look broken rather than unconfigured: the keys
  // were simply never added to the deployment.
  it("reports missing keys instead of claiming to be configured", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    expect(pushConfigurationStatus()).toEqual({
      configured: false,
      publicKey: false,
      privateKey: false,
      subject: false,
    });
  });

  it("treats the .env.example placeholders as unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "your-vapid-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "your-vapid-private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:you@your-domain");
    expect(pushConfigurationStatus().configured).toBe(false);
  });

  it("does not leak the key values", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BEbBpublickey");
    vi.stubEnv("VAPID_PRIVATE_KEY", "supersecret");
    vi.stubEnv("VAPID_SUBJECT", "mailto:dispatch@sswsco.com");
    expect(JSON.stringify(pushConfigurationStatus())).not.toContain(
      "supersecret",
    );
  });
});
