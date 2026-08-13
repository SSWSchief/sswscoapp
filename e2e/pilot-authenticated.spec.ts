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
  const submit = page.getByRole("button", { name: /sign in/i });
  await expect(submit).toBeEnabled();
  await page.getByLabel(/email/i).fill(email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(password);
  await submit.click();
}

/**
 * Assert the current page by its Topbar heading. The sidebar is `hidden md:flex`,
 * so plain text locators resolve to hidden desktop nav links on the tablet and
 * mobile projects; the `h1` is the one identity every viewport renders.
 */
function expectPage(page: Page, title: string) {
  return expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
}

test.describe("authenticated production journeys", () => {
  test("administrator reaches every activated office module", async ({
    page,
  }) => {
    test.skip(!hasAdmin, "Requires approved staging admin identity");
    await signIn(
      page,
      process.env.E2E_ADMIN_EMAIL!,
      process.env.E2E_ADMIN_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/management/);
    for (const [path, heading] of [
      ["/dispatcher/invoices", "Invoices"],
      ["/dispatcher/reports", "Reports"],
      ["/dispatcher/map", "Locations & AirTags"],
      ["/dispatcher/messages", "Messages"],
      ["/dispatcher/settings", "Settings"],
    ]) {
      await page.goto(path);
      await expectPage(page, heading);
    }
    await page.goto("/management");
    await expectPage(page, "Management Overview");
    // Owners drive too, so the driver portal must open for them as well.
    for (const [path, heading] of [
      ["/driver/jobs", "My Jobs"],
      ["/driver/pre-trip", "Electronic Pre-Trip"],
      ["/driver/time-clock", "Time Clock"],
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path));
      await expectPage(page, heading);
    }
    // All three portals must be reachable by name, on whichever surface this
    // viewport actually offers. The sidebar is `hidden md:flex`, and a
    // display:none element is absent from the accessibility tree entirely — so
    // a role-based locator finds nothing on a phone no matter how long it
    // waits, and `toBeAttached` does not change that. Walk the real path
    // instead: on a phone the portals live behind the menu button.
    await page.goto("/management");
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    for (const name of ["Management", "Dispatch", "Driver"])
      await expect(
        page.getByRole("link", { name, exact: true }).first(),
        `${name} portal should be reachable`,
      ).toBeVisible({ timeout: 20_000 });
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
    await expect(
      page.getByText("No training dataset is active."),
    ).toBeVisible();
  });
  test("dispatcher reaches live daily operations", async ({ page }) => {
    test.skip(!hasDispatcher, "Requires approved staging dispatcher identity");
    await signIn(
      page,
      process.env.E2E_DISPATCHER_EMAIL!,
      process.env.E2E_DISPATCHER_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/dispatcher\/dashboard/);
    await expect(
      page.getByRole("link", { name: /view all jobs/i }),
    ).toBeVisible();
    await page.goto("/dispatcher/jobs");
    await expectPage(page, "Jobs");
    await page.goto("/dispatcher/messages");
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible();
  });
  test("driver reaches field, time, messages, pre-trip, and SOP workflows", async ({
    page,
  }) => {
    test.skip(!hasDriver, "Requires approved staging driver identity");
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
    test.skip(!hasInactive, "Requires approved inactive staging identity");
    await signIn(
      page,
      process.env.E2E_INACTIVE_EMAIL!,
      process.env.E2E_INACTIVE_PASSWORD!,
    );
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('p[role="alert"]')).toContainText(
      /inactive|not linked/i,
    );
  });
  test("reduced dispatcher cannot open revoked modules", async ({ page }) => {
    test.skip(!hasReduced, "Requires approved reduced-permission identity");
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
