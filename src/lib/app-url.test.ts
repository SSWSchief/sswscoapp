import { afterEach, describe, expect, it, vi } from "vitest";
import { emailRedirectUrl, requireAppUrl, resolveAppUrl } from "./app-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAppUrl", () => {
  it("prefers the explicitly configured address", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sswscoapp.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "something-else.vercel.app");

    expect(resolveAppUrl()).toEqual({
      url: "https://sswscoapp.vercel.app",
      source: "configured",
    });
  });

  it("accepts Vercel's production domain, which arrives without a protocol", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "sswscoapp.vercel.app");

    expect(resolveAppUrl()).toEqual({
      url: "https://sswscoapp.vercel.app",
      source: "vercel",
    });
  });

  it("reduces a configured value to its origin, so a stray path cannot be appended to", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sswscoapp.vercel.app/login/");

    expect(resolveAppUrl().url).toBe("https://sswscoapp.vercel.app");
  });

  it("never throws, so a build with no Vercel variables still prerenders", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");

    expect(resolveAppUrl().source).toBe("development");
  });
});

describe("requireAppUrl", () => {
  it("refuses the localhost fallback in production rather than emailing it out", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => requireAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});

describe("emailRedirectUrl", () => {
  it("builds an absolute link on the configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sswscoapp.vercel.app");

    expect(emailRedirectUrl("/reset-password")).toBe(
      "https://sswscoapp.vercel.app/auth/confirm?next=%2Freset-password",
    );
  });
});
