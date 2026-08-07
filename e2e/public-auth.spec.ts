import { expect, test } from "@playwright/test";

test("public entry links to authentication", async ({ page }) => { await page.goto("/", { waitUntil: "domcontentloaded" }); await expect(page.getByText(/Secure employee operations/i)).toBeVisible(); await expect(page.getByRole("link", { name: /Dispatcher Portal/i })).toHaveAttribute("href", "/login"); });
test("protected dispatch route redirects anonymous users", async ({ page }) => { await page.goto("/dispatcher/dashboard",{waitUntil:"domcontentloaded"}); await expect(page).toHaveURL(/\/login\?next=%2Fdispatcher%2Fdashboard/); });
test("password-reset UI is reachable", async ({ page }) => { await page.goto("/reset-password"); await expect(page.getByRole("heading", { name: /password/i })).toBeVisible(); });
