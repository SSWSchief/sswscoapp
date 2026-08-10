import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { acceptanceEnvironmentAvailable } from "./environment";

/**
 * Guards the emailed-link redemption chain.
 *
 * Every employee reaches the application for the first time through an
 * administrator-generated invitation. Those links are not PKCE: Supabase
 * returns their tokens in the URL hash fragment, which never reaches a server
 * route. `/auth/confirm` therefore redeems them with `verifyOtp` and a
 * `token_hash`. Nothing covered this path before, and it was broken in
 * production without anyone noticing.
 *
 * `generateLink` issues a real token without sending email, so this runs
 * without SMTP configured.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const available = acceptanceEnvironmentAvailable([
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "E2E_ADMIN_EMAIL",
]);

test.describe("emailed link redemption", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium" || !available,
    "Runs once with bootstrapped staging identities",
  );

  test("an administrator-generated recovery link reaches the password form", async ({
    page,
  }) => {
    const service = createClient(url!, secret!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const link = await service.auth.admin.generateLink({
      type: "recovery",
      email: process.env.E2E_ADMIN_EMAIL!,
    });
    expect(link.error).toBeNull();
    const tokenHash = link.data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();

    await page.goto(
      `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`,
    );
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(
      page.getByRole("heading", { name: /password/i }),
    ).toBeVisible();
  });

  test("a spent or forged token is rejected with a visible explanation", async ({
    page,
  }) => {
    await page.goto(
      "/auth/confirm?token_hash=forged-token-value&type=recovery&next=/reset-password",
    );
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('p[role="alert"]')).toContainText(
      /invalid or has expired/i,
    );
  });
});
