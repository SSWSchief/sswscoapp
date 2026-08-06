import { expect, test } from "@playwright/test";

test.describe("authenticated Phase 1 journeys", () => {
  test.skip(!process.env.E2E_DISPATCHER_EMAIL || !process.env.E2E_DISPATCHER_PASSWORD, "Requires an approved staging dispatcher identity");
  test("dispatcher can sign in and reach live jobs", async ({ page }) => { await page.goto("/login"); await page.getByLabel(/email/i).fill(process.env.E2E_DISPATCHER_EMAIL!); await page.getByLabel(/password/i).fill(process.env.E2E_DISPATCHER_PASSWORD!); await page.getByRole("button", { name: /sign in/i }).click(); await expect(page).toHaveURL(/\/dispatcher\/dashboard/); await expect(page.getByRole("button", { name: /new job/i })).toBeVisible(); });
});
