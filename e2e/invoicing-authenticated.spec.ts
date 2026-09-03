import { expect, test, type Page } from "@playwright/test";
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
const hasDispatcher = acceptanceEnvironmentAvailable([
  "E2E_DISPATCHER_EMAIL",
  "E2E_DISPATCHER_PASSWORD",
]);
const sendingEnabled = process.env.STRIPE_INVOICING_ENABLED === "true";

async function signInAsDispatcher(page: Page) {
  await page.goto("/login");
  const submit = page.getByRole("button", { name: /sign in/i });
  await expect(submit).toBeEnabled();
  await page.getByLabel(/email/i).fill(process.env.E2E_DISPATCHER_EMAIL as string);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(process.env.E2E_DISPATCHER_PASSWORD as string);
  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openInvoices(page: Page) {
  await page.goto("/dispatcher/invoices");
  await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
}

/** The first completed job offered for a customer, or null when none is free. */
async function selectFirstEligibleJob(page: Page) {
  const jobs = page.getByRole("radio");
  if (!(await jobs.count())) return null;
  const label = await jobs.first().locator("xpath=..").innerText();
  await jobs.first().check();
  return label;
}

test.describe("invoice drafting", () => {
  test.skip(!hasDispatcher, "dispatcher acceptance credentials are not configured");

  test("assembles a draft whose total comes from its line items", async ({ page }) => {
    await signInAsDispatcher(page);
    await openInvoices(page);
    await page.getByRole("button", { name: "New invoice" }).click();

    const customer = page.getByLabel(/customer/i);
    await expect(customer).toBeVisible();
    const options = await customer.locator("option").all();
    // The first option is the "Select customer" placeholder.
    test.skip(options.length < 2, "staging has no customers seeded");
    await customer.selectOption({ index: 1 });

    const job = await selectFirstEligibleJob(page);
    test.skip(job === null, "the seeded customer has no uninvoiced completed job");

    await page.getByLabel("Line 1 description").fill("Acceptance haul");
    await page.getByLabel("Line 1 amount").fill("425.50");
    await expect(page.getByText(/Total:\s*\$425\.50/)).toBeVisible();

    // A draft has no number until the transactional counter assigns one.
    await expect(page.getByLabel(/invoice number/i)).toHaveValue(/Assigned when saved/i);

    await page.getByRole("button", { name: /save draft/i }).click();
    await expect(page.getByText(/Invoice draft saved/i)).toBeVisible();
  });

  test("refuses a draft with no completed work behind it", async ({ page }) => {
    await signInAsDispatcher(page);
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
    await signInAsDispatcher(page);
    await openInvoices(page);

    // The table says "View"; the stacked mobile list says "View invoice".
    const view = page.getByRole("button", { name: /^View( invoice)?$/ }).first();
    test.skip(!(await view.count()), "staging holds no finalized invoices yet");
    await view.click();

    await expect(page.getByText(/finalized and read-only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /save draft/i })).toHaveCount(0);
    await expect(page.getByLabel("Line 1 description")).toBeDisabled();
  });
});

test.describe("Stripe delivery", () => {
  test.skip(!hasDispatcher, "dispatcher acceptance credentials are not configured");
  test.skip(
    !sendingEnabled,
    "STRIPE_INVOICING_ENABLED is not true for this deployment, so sending is off by design",
  );

  test("sends a draft and exposes the hosted payment page", async ({ page }) => {
    await signInAsDispatcher(page);
    await openInvoices(page);

    const send = page.getByRole("button", { name: /send via stripe/i }).first();
    test.skip(!(await send.count()), "no unsent draft is available to send");
    await send.click();

    await expect(page.getByText(/sent to the customer/i)).toBeVisible({ timeout: 30_000 });
    // Once Stripe has it, the row offers the payment page instead of a send.
    await expect(page.getByRole("link", { name: /payment page/i }).first()).toBeVisible();
  });

  test("offers no second send for an invoice Stripe already holds", async ({ page }) => {
    await signInAsDispatcher(page);
    await openInvoices(page);

    const paymentPages = page.getByRole("link", { name: /payment page/i });
    test.skip(!(await paymentPages.count()), "staging holds no sent invoices yet");

    // A table row on desktop, a list item on mobile; whichever encloses it.
    const row = paymentPages.first().locator("xpath=ancestor::*[self::tr or self::li][1]");
    await expect(row.getByRole("button", { name: /send via stripe/i })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /refresh stripe/i })).toBeVisible();
  });
});
