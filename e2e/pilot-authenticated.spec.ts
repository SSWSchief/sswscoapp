import { expect, test, type Page } from "@playwright/test";
import { acceptanceEnvironmentAvailable } from "./environment";

const hasAdmin = acceptanceEnvironmentAvailable([
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
]);
const hasDispatcher = acceptanceEnvironmentAvailable([
  "E2E_DISPATCHER_EMAIL",
  "E2E_DISPATCHER_PASSWORD",
]);
const hasDriver = acceptanceEnvironmentAvailable([
  "E2E_DRIVER_EMAIL",
  "E2E_DRIVER_PASSWORD",
]);
const hasInactive = acceptanceEnvironmentAvailable([
  "E2E_INACTIVE_EMAIL",
  "E2E_INACTIVE_PASSWORD",
]);
const hasReduced = acceptanceEnvironmentAvailable([
  "E2E_REDUCED_EMAIL",
  "E2E_REDUCED_PASSWORD",
]);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("authenticated production journeys", () => {
  test("administrator reaches every activated office module", async ({
    page,
  }) => {
    test.skip(
      !hasAdmin,
      "Requires approved staging admin identity",
    );
    await signIn(
      page,
      process.env.E2E_ADMIN_EMAIL!,
      process.env.E2E_ADMIN_PASSWORD!,
    );
    for (const [path, heading] of [
      ["/dispatcher/invoices", "Invoices"],
      ["/dispatcher/reports", "Reports"],
      ["/dispatcher/map", "Locations & AirTags"],
      ["/dispatcher/messages", "Messages"],
      ["/dispatcher/settings", "Settings"],
    ]) {
      await page.goto(path);
      await expect(
        page.getByText(heading, { exact: false }).first(),
      ).toBeVisible();
    }
    await page.goto("/management");
    await expect(page.getByText("Management Portal")).toBeVisible();
    await page.goto("/dispatcher/settings");
    await page.getByRole("tab", { name: "Training Data" }).click();
    const create = page.getByRole("button", { name: "Create Training Data" });
    if (await create.isVisible()) await create.click();
    await expect(page.getByText("Training dataset is active.")).toBeVisible();
    await page.getByRole("button", { name: "Remove Training Data" }).click();
    await page
      .getByLabel(/Type DELETE TRAINING DATA/)
      .fill("DELETE TRAINING DATA");
    await page.getByRole("button", { name: "Remove All Five Records" }).click();
    await expect(page.getByText("No training dataset is active.")).toBeVisible();
  });
  test("dispatcher reaches live daily operations", async ({ page }) => {
    test.skip(
      !hasDispatcher,
      "Requires approved staging dispatcher identity",
    );
    await signIn(
      page,
      process.env.E2E_DISPATCHER_EMAIL!,
      process.env.E2E_DISPATCHER_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/dispatcher\/dashboard/);
    await expect(page.getByRole("button", { name: /new job/i })).toBeVisible();
    await page.goto("/dispatcher/jobs");
    await expect(page.getByText("Jobs", { exact: true }).first()).toBeVisible();
    await page.goto("/dispatcher/messages");
    await expect(page.getByText("Channels")).toBeVisible();
  });
  test("driver reaches field, time, messages, pre-trip, and SOP workflows", async ({
    page,
  }) => {
    test.skip(
      !hasDriver,
      "Requires approved staging driver identity",
    );
    await signIn(
      page,
      process.env.E2E_DRIVER_EMAIL!,
      process.env.E2E_DRIVER_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/driver\/jobs/);
    await expect(page.getByRole("button", { name: "Upcoming" })).toBeVisible();
    for (const path of [
      "/driver/time-clock",
      "/driver/messages",
      "/driver/pre-trip",
      "/driver/sops",
    ]) {
      await page.goto(path);
      await expect(page.locator("main, header").first()).toBeVisible();
    }
  });
  test("inactive employee is rejected", async ({ page }) => {
    test.skip(
      !hasInactive,
      "Requires approved inactive staging identity",
    );
    await signIn(
      page,
      process.env.E2E_INACTIVE_EMAIL!,
      process.env.E2E_INACTIVE_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert")).toContainText(/inactive|not linked/i);
  });
  test("reduced dispatcher cannot open revoked modules", async ({ page }) => {
    test.skip(
      !hasReduced,
      "Requires approved reduced-permission identity",
    );
    await signIn(
      page,
      process.env.E2E_REDUCED_EMAIL!,
      process.env.E2E_REDUCED_PASSWORD!,
    );
    await page.goto("/dispatcher/customers");
    await expect(page).not.toHaveURL(/\/dispatcher\/customers/);
    await expect(page.getByRole("link", { name: "Customers" })).toHaveCount(0);
  });
});
