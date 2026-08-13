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
});

// Password recovery depends on whether the project can actually send mail, and
// getting this wrong strands an employee waiting on an email that was never
// sent. Both states are asserted so neither can regress unnoticed.
test("password recovery matches the project's email capability", async ({
  page,
}) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  const resetButton = page.getByRole("button", { name: "Forgot password?" });

  if (process.env.NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED === "true") {
    await resetButton.click();
    await expect(
      page.getByText("Enter your email address first.", { exact: true }),
    ).toBeVisible();
    return;
  }

  // No SMTP: the control must not exist at all, and the screen must point the
  // employee at an administrator rather than imply a mail was sent.
  await expect(resetButton).toHaveCount(0);
  await expect(
    page.getByText(/Ask an administrator to issue you a new temporary password/),
  ).toBeVisible();
  await expect(page.getByText(/instructions were sent/i)).toHaveCount(0);
});
test("protected dispatch route redirects anonymous users", async ({ page }) => {
  await page.goto("/dispatcher/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login\?next=%2Fdispatcher%2Fdashboard/);
});
test("password-reset UI is reachable", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: /password/i })).toBeVisible();
});
