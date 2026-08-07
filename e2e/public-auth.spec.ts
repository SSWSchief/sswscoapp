import { expect, test } from "@playwright/test";

test("public entry routes anonymous users to authentication", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: /Welcome Back/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.locator("#login-password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(
    page.getByText("Enter your email address first.", { exact: true }),
  ).toBeVisible();
});
test("protected dispatch route redirects anonymous users", async ({ page }) => {
  await page.goto("/dispatcher/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fdispatcher%2Fdashboard/);
});
test("password-reset UI is reachable", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: /password/i })).toBeVisible();
});
