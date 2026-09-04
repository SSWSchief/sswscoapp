import { expect, test, type Locator, type Page } from "@playwright/test";
import { acceptanceEnvironmentAvailable } from "./environment";

/**
 * Staging acceptance for the invoicing lifecycle.
 *
 * The staging workflow sets STRIPE_INVOICING_ENABLED and staging Stripe
 * secrets, and until this existed nothing exercised them — the invoice suite
 * was configured but never run. Draft assembly is checked unconditionally
 * because it touches no external system; the send is gated on the same flag the
 * deployment is, so a run against a deployment with sending disabled reports
 * that rather than failing.
 */
// Invoicing is administrator-only: `rolePermissions` in src/lib/permissions.ts
// grants `invoices` to admin and to nobody else, so a dispatcher identity never
// reaches /dispatcher/invoices despite the route living under that prefix.
const hasAdmin = acceptanceEnvironmentAvailable([
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
]);
const sendingEnabled = process.env.STRIPE_INVOICING_ENABLED === "true";

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: /sign in/i });
  await expect(submit).toBeEnabled();
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL as string);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD as string);
  await submit.click();
  // Wait for the post-login redirect itself, not merely for some heading to
  // appear. The login page already renders an h1, so a generic heading check
  // resolves immediately and the next goto races the session being written —
  // which lands back on /login with no Invoices heading to find.
  await expect(page).toHaveURL(/\/management/);
}

async function openInvoices(page: Page) {
  await page.goto("/dispatcher/invoices");
  await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
}

/**
 * Whether a control exists, once the invoice list has had time to arrive.
 *
 * The heading renders before the rows do, so sampling immediately reports
 * nothing and every assertion below it skips itself as "no data" when the data
 * was merely late. Waiting and then counting distinguishes an empty ledger from
 * an unfinished render; a miss is a real absence, so it settles into a skip
 * rather than a failure.
 */
async function present(locator: Locator) {
  await locator.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  return (await locator.count()) > 0;
}

/**
 * The first completed job offered for a customer.
 *
 * The list arrives from /api/invoices/eligible-jobs after the customer is
 * chosen, so this waits for it rather than sampling once — reading the DOM
 * immediately finds an empty list and looks indistinguishable from a customer
 * with no billable work. The wait is short so a genuine absence reports itself
 * rather than eating the test's whole time budget and timing out instead.
 */
async function selectFirstEligibleJob(page: Page) {
  const jobs = page.getByRole("radio");
  await expect
    .poll(() => jobs.count(), { timeout: 10_000 })
    .toBeGreaterThan(0);
  const label = await jobs.first().locator("xpath=..").innerText();
  await jobs.first().check();
  return label;
}

test.describe("invoice drafting", () => {
  test.skip(!hasAdmin, "administrator acceptance credentials are not configured");

  test("assembles a draft whose total comes from its line items", async ({ page }) => {
    await signInAsAdmin(page);
    await openInvoices(page);
    await page.getByRole("button", { name: "New invoice" }).click();

    const customer = page.getByLabel(/customer/i);
    await expect(customer).toBeVisible();
    // Pick the seeded acceptance customer by id rather than by position: it is
    // the one the bootstrap gives a complete billing address and a completed
    // job, and dropdown order depends on whatever else the project holds.
    // Poll for it — the customer list streams in from the operations provider
    // after the select itself renders, so one immediate read sees a dropdown
    // holding nothing but the placeholder.
    await expect
      .poll(() => customer.locator('option[value="e2e-customer"]').count(), {
        timeout: 15_000,
      })
      .toBe(1);
    await customer.selectOption("e2e-customer");

    await selectFirstEligibleJob(page);

    await page.getByLabel("Line 1 description").fill("Acceptance haul");
    await page.getByLabel("Line 1 amount").fill("425.50");
    await expect(page.getByText(/Total:\s*\$425\.50/)).toBeVisible();

    // A draft has no number until the transactional counter assigns one.
    await expect(page.getByLabel(/invoice number/i)).toHaveValue(/Assigned when saved/i);

    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page.getByText(/Invoice draft saved/i)).toBeVisible();
  });

  test("refuses a draft with no completed work behind it", async ({ page }) => {
    await signInAsAdmin(page);
    await openInvoices(page);
    await page.getByRole("button", { name: "New invoice" }).click();

    await page.getByLabel("Line 1 description").fill("Unbacked charge");
    await page.getByLabel("Line 1 amount").fill("100.00");
    await page.getByRole("button", { name: /save draft/i }).click();

    await expect(
      page.getByText(/Select completed work, use non-zero line amounts/i),
    ).toBeVisible();
  });

  test("shows a finalized invoice as read-only rather than editable", async ({ page }) => {
    await signInAsAdmin(page);
    await openInvoices(page);

    // The table says "View"; the stacked mobile list says "View invoice".
    const view = page.getByRole("button", { name: /^View( invoice)?$/ });
    test.skip(!(await present(view)), "staging holds no finalized invoices yet");
    await view.first().click();

    await expect(page.getByText(/finalized and read-only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i })).toHaveCount(0);
    await expect(page.getByLabel("Line 1 description")).toBeDisabled();
  });
});

test.describe("Stripe delivery", () => {
  test.skip(!hasAdmin, "administrator acceptance credentials are not configured");
  test.skip(
    !sendingEnabled,
    "STRIPE_INVOICING_ENABLED is not true for this deployment, so sending is off by design",
  );

  test("sends a draft and exposes the hosted payment page", async ({ page }) => {
    await signInAsAdmin(page);
    await openInvoices(page);

    const send = page.getByRole("button", { name: /send via stripe/i });
    test.skip(!(await present(send)), "no unsent draft is available to send");
    await send.first().click();

    // Read whichever toast appears and quote it. A refused send raises an error
    // toast (role="alert"); asserting only on the success wording reports
    // "element not found" and throws away the reason the send was refused,
    // which is the one thing worth knowing when this fails.
    // Scoped to the toast region: role="status" also matches empty live
    // regions elsewhere on the page, and reading one of those reports the
    // application said nothing at all.
    const toast = page
      .locator('[aria-live] [role="status"], [aria-live] [role="alert"]')
      .first();
    await toast.waitFor({ state: "visible", timeout: 30_000 });
    const said = (await toast.innerText()).replace(/\s+/g, " ").trim();
    expect(said, `the app reported: "${said}"`).toMatch(/sent to the customer/i);

    // Once Stripe has it, the row offers the payment page instead of a send.
    await expect(page.getByRole("link", { name: /payment page/i }).first()).toBeVisible();
  });

  test("offers no second send for an invoice Stripe already holds", async ({ page }) => {
    await signInAsAdmin(page);
    await openInvoices(page);

    const paymentPages = page.getByRole("link", { name: /payment page/i });
    test.skip(!(await present(paymentPages)), "staging holds no sent invoices yet");

    // A table row on desktop, a list item on mobile; whichever encloses it.
    const row = paymentPages.first().locator("xpath=ancestor::*[self::tr or self::li][1]");
    // The point of this test: once Stripe holds an invoice it can never be sent
    // a second time. Which other controls the row offers depends on where the
    // invoice sits — a voided one keeps its payment link but is terminal, so it
    // deliberately offers no reconcile — and asserting on those would be
    // asserting on the fixture rather than on the rule.
    await expect(row.getByRole("button", { name: /send via stripe/i })).toHaveCount(0);
  });
});
