/**
 * Captures every screenshot in docs/client-user-guide.md.
 *
 * Point this at STAGING, never production: the guide is handed to employees, so
 * no real customer or employee record may appear in it. The five records
 * created by Settings → Training Data are the intended subject, and the script
 * refuses to finish if a page it captured shows a customer that is not labeled
 * TRAINING.
 *
 * Nobody types a password. Sessions are opened with single-use links minted by
 * the Supabase admin API — see scripts/guide-environment.mjs — using the
 * staging credentials already in .env.local, so no employee password is needed
 * and none can end up in the repository or in a screenshot.
 *
 *   GUIDE_ADMIN_EMAIL       an active administrator on the staging project
 *   GUIDE_DRIVER_EMAIL      the practice driver holding #TRAINING-001
 *   GUIDE_DISPATCHER_EMAIL  optional; the office section otherwise runs as the
 *                           administrator, whose sidebar carries two extra
 *                           items a dispatcher will not see
 *
 * Run scripts/prepare-guide-fixtures.mjs first; it creates the training
 * dataset, the practice driver, and the published checklist and SOP these
 * screenshots depend on.
 *
 * The driver walkthrough advances the training job pending → en route →
 * arrived and uploads one placeholder photo. It deliberately stops short of
 * completing the job: completion is irreversible and would empty My Jobs. To
 * re-run from the beginning, remove and re-create the training dataset from
 * Settings → Training Data, then run the fixtures script again.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { chromium, devices } from "@playwright/test";
import {
  loadEnvironment,
  serviceClient,
  signInUrl,
} from "./guide-environment.mjs";

const OUTPUT_DIR = "docs/images/guide";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const SERVER_TIMEOUT_MS = 120_000;

const config = loadEnvironment();
const service = serviceClient(config);

/* ------------------------------------------------------------------ setup */

function accounts() {
  const admin = process.env.GUIDE_ADMIN_EMAIL ?? "tehronporter@gmail.com";
  const driver = process.env.GUIDE_DRIVER_EMAIL;
  if (!driver)
    throw new Error(
      "GUIDE_DRIVER_EMAIL is required. Run scripts/prepare-guide-fixtures.mjs; " +
        "it prints the address of the practice driver it creates.",
    );
  const dispatcher = process.env.GUIDE_DISPATCHER_EMAIL ?? null;
  if (!dispatcher)
    console.warn(
      "! GUIDE_DISPATCHER_EMAIL not set — capturing the office section as the administrator.\n" +
        "  Those screenshots will show Management Overview and Settings in the sidebar, which a dispatcher does not have.",
    );
  return { admin, driver, dispatcher: dispatcher ?? admin };
}

async function reachable(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.status > 0;
  } catch {
    return false;
  }
}

/** Starts `npm run dev` if nothing is answering, mirroring playwright.config.ts. */
async function ensureServer() {
  if (await reachable(BASE_URL)) {
    console.log(`· using the server already running at ${BASE_URL}`);
    return null;
  }
  if (process.env.PLAYWRIGHT_BASE_URL)
    throw new Error(`Nothing is listening at ${BASE_URL}`);
  console.log("· starting npm run dev");
  const server = spawn("npm", ["run", "dev"], { stdio: "ignore" });
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await reachable(BASE_URL)) return server;
  }
  server.kill();
  throw new Error(`npm run dev did not answer within ${SERVER_TIMEOUT_MS}ms`);
}

/**
 * A plain grey-blue PNG standing in for a completion photo. Written by hand so
 * the script needs no image dependency — a real photo would be a real job site.
 */
function placeholderPhoto(width = 960, height = 720) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      raw[offset] = 0x9a;
      raw[offset + 1] = 0xa8;
      raw[offset + 2] = 0xb4;
      offset += 3;
    }
  }
  const chunk = (type, body) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const payload = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([length, payload, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* --------------------------------------------------------------- capturing */

/**
 * Document order of the guide. A screenshot's number comes from its position
 * here rather than from a running counter, so a step that cannot be captured
 * (an unassigned training job, a checklist nobody has published) leaves one
 * gap instead of renumbering every file after it and silently breaking the
 * image paths in the Markdown.
 */
const ORDER = [
  "sign-in-desktop",
  "sign-in-phone",
  "change-password",
  "portals-sidebar",
  "driver-my-jobs",
  "driver-job-details",
  "driver-job-en-route",
  "driver-job-arrived",
  "driver-job-photo",
  "driver-job-note",
  "driver-dry-run",
  "driver-time-clock",
  "driver-time-request",
  "driver-pre-trip",
  "driver-sops",
  "driver-messages",
  "driver-profile",
  "dispatch-overview",
  "dispatch-jobs",
  "dispatch-new-job",
  "dispatch-job-details",
  "dispatch-cancel-job",
  "dispatch-customers",
  "dispatch-add-customer",
  "dispatch-trucks",
  "dispatch-dumpsters",
  "dispatch-locations",
  "dispatch-time-clock",
  "dispatch-absence",
  "dispatch-invoices",
  "dispatch-reports",
  "dispatch-messages",
  "admin-management",
  "admin-employees",
  "admin-add-employee",
  "admin-employee-access",
  "admin-settings-company",
  "admin-settings-checklist",
  "admin-settings-sops",
  "admin-settings-training",
];

const captured = [];

/**
 * Confirmation toasts stack over the bottom action bar on a phone, hiding the
 * very buttons a step is meant to show. They sit above everything at z-100 and
 * linger for four seconds, so they are dismissed rather than waited out.
 */
async function clearToasts(page) {
  const dismiss = page.getByRole("button", { name: "Dismiss" });
  for (let i = 0; i < 5 && (await dismiss.count()); i += 1) {
    await dismiss
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});
    await page.waitForTimeout(150);
  }
  await dismiss
    .first()
    .waitFor({ state: "detached", timeout: 6000 })
    .catch(() => {});
}

/**
 * Grows the viewport until the app's own scroll container fits.
 *
 * Both shells are fixed-height flex layouts whose content scrolls inside
 * `.portal-content` (office) or a `flex-1 overflow-y-auto` panel (driver). The
 * document itself never grows, so Playwright's `fullPage` is a no-op and every
 * screenshot was silently sliced at the fold — the dispatcher job page lost its
 * Photos and Activity panels that way. Resizing the viewport instead lets the
 * real layout reflow, so the capture shows the whole screen with nothing cut.
 */
async function fitViewport(page, maxHeight) {
  const size = page.viewportSize();
  if (!size) return null;
  const overflow = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll("*")].filter((node) => {
      const style = getComputedStyle(node);
      return (
        /auto|scroll/.test(style.overflowY) &&
        node.scrollHeight - node.clientHeight > 4
      );
    });
    const worst = Math.max(
      0,
      ...scrollers.map((node) => node.scrollHeight - node.clientHeight),
      document.documentElement.scrollHeight - window.innerHeight,
    );
    return worst;
  });
  if (overflow <= 0) return null;
  const height = Math.min(size.height + overflow + 24, maxHeight);
  if (height <= size.height) return null;
  await page.setViewportSize({ width: size.width, height });
  await page.waitForTimeout(450); // reflow, lazy rows, sticky bars
  return size;
}

/**
 * Screenshots the current screen under its guide-order name.
 *
 * `fit` is off for dialogs: a modal is a fixed overlay, so growing the viewport
 * only stretches the dimmed page behind it.
 */
async function shot(page, slug, { fit = false, maxHeight = 1500 } = {}) {
  const position = ORDER.indexOf(slug);
  if (position < 0) throw new Error(`"${slug}" is not listed in ORDER`);
  const name = `${String(position + 1).padStart(2, "0")}-${slug}.png`;
  await clearToasts(page);
  const restore = fit ? await fitViewport(page, maxHeight) : null;
  await page.waitForTimeout(400); // let transitions settle
  await page.screenshot({ path: join(OUTPUT_DIR, name) });
  if (restore) {
    await page.setViewportSize(restore);
    await page.waitForTimeout(250);
  }
  captured.push({ name, url: page.url() });
  console.log(`  ${name}`);
  return name;
}

/**
 * The dev server paints a floating build-status badge over the bottom-left
 * corner of every page. It is not part of the product and has no business in a
 * guide handed to employees.
 */
const HIDE_DEV_OVERLAY =
  "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }";

/**
 * Tracks the app's own "records are loaded" signal.
 *
 * OperationsProvider logs `operations_refresh_complete` when a fetch settles.
 * Waiting on that is the only reliable readiness cue: the shell's h1 paints
 * before any record arrives, `networkidle` never fires because Supabase holds
 * a realtime websocket open, and an empty-state locator matches *while*
 * loading — which is exactly how an earlier run photographed "You're all
 * caught up" on a driver who did have a job.
 */
const loaded = new WeakMap();

function trackOperations(page) {
  loaded.set(page, false);
  page.on("console", (message) => {
    if (message.text().includes("operations_refresh_complete"))
      loaded.set(page, true);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) loaded.set(page, false);
  });
}

async function waitForOperations(page, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (loaded.get(page)) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function newPage(context) {
  const page = await context.newPage();
  // `next dev` compiles each route on first request, which can take far longer
  // than Playwright's 30s default on a cold route.
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(45_000);
  trackOperations(page);
  await page.addInitScript((css) => {
    const inject = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    };
    if (document.head) inject();
    else document.addEventListener("DOMContentLoaded", inject);
  }, HIDE_DEV_OVERLAY);
  return page;
}

/**
 * Opens a session by redeeming a freshly minted link. Each token is single-use,
 * so this mints one per call rather than reusing a URL.
 */
async function signIn(page, email, landing = "/") {
  const url = await signInUrl(service, email, BASE_URL, landing);
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
  if (new URL(page.url()).pathname.startsWith("/login"))
    throw new Error(
      `Could not open a session for ${email}: /auth/confirm rejected the link. ` +
        "Check that the account exists and its employee profile is active.",
    );
}

/**
 * Every screen renders its identity as an h1; the sidebar is hidden on mobile.
 *
 * Waits for the shell, then for the records to actually land, then for an
 * optional `expect` locator naming something only the loaded page shows.
 */
async function open(page, path, heading, expect) {
  await page.goto(`${BASE_URL}${path}`);
  await page
    .getByRole("heading", { level: 1, name: heading })
    .waitFor({ state: "visible", timeout: 30_000 });
  await waitForOperations(page);
  if (expect) await expect(page).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(700); // let the last row and any badge settle
}

/** Dismisses an open dialog and waits for it to actually leave the DOM. */
async function closeModal(page) {
  const dialog = page.locator('[role="dialog"]');
  if (!(await dialog.count())) return;
  await page.keyboard.press("Escape");
  await dialog
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(async () => {
      // Escape is handled on window; if focus sat inside an input that
      // swallowed it, fall back to the dialog's own close control.
      await page.getByRole("button", { name: "Close dialog" }).first().click();
      await dialog.first().waitFor({ state: "detached", timeout: 10_000 });
    });
}

/* ---------------------------------------------------------------- sections */

async function captureSignIn(browser, admin) {
  console.log("\nGetting in");
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await newPage(desktop);
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole("button", { name: /sign in/i }).waitFor();
  await shot(page, "sign-in-desktop");

  const phone = await browser.newContext({ ...devices["iPhone 13"] });
  const phonePage = await newPage(phone);
  await phonePage.goto(`${BASE_URL}/login`);
  await phonePage.getByRole("button", { name: /sign in/i }).waitFor();
  await shot(phonePage, "sign-in-phone");
  await phone.close();

  // Change Password and the Portals list both need a session. The
  // administrator is the only account holding more than one portal, so it is
  // also the only one that renders the Portals list at all.
  await signIn(page, admin);
  await page.goto(`${BASE_URL}/reset-password`);
  await page.getByRole("heading", { name: "Set new password" }).waitFor();
  await shot(page, "change-password");

  await open(page, "/management", "Management Overview");
  await shot(page, "portals-sidebar", { fit: true });
  await desktop.close();
}

async function captureDriver(browser, driver) {
  console.log("\nFor drivers");
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await newPage(context);
  await signIn(page, driver);

  // The fixtures guarantee an assigned job, so wait for the card itself rather
  // than accepting the empty state — which renders while records are still in
  // flight and would otherwise be photographed as "You're all caught up".
  await open(page, "/driver/jobs", "My Jobs", (p) =>
    p.getByRole("link", { name: /open job/i }).first(),
  );
  await shot(page, "driver-my-jobs");

  let openJob = page.getByRole("link", { name: /open job/i }).first();
  if (!(await openJob.count())) {
    // A job scheduled past Pacific midnight sits under Upcoming, not Today.
    await page.getByRole("button", { name: "Upcoming" }).click();
    await page.waitForTimeout(600);
    openJob = page.getByRole("link", { name: /open job/i }).first();
  }
  if (!(await openJob.count())) {
    console.warn(
      "! No job is assigned to this driver — skipping the job walkthrough.\n" +
        "  Run scripts/prepare-guide-fixtures.mjs, then re-run this script.",
    );
  } else {
    await openJob.click();
    await page
      .getByRole("heading", { level: 1, name: /^Job / })
      .waitFor({ state: "visible" });
    await shot(page, "driver-job-details");

    const startRoute = page.getByRole("button", { name: "Start Route" });
    if (await startRoute.count()) {
      await startRoute.click();
      await page.getByRole("button", { name: "Arrived" }).waitFor();
      await shot(page, "driver-job-en-route");
    }

    const arrived = page.getByRole("button", { name: "Arrived" });
    if (await arrived.count()) {
      await arrived.click();
      await page.getByRole("button", { name: /complete/i }).first().waitFor();
      await shot(page, "driver-job-arrived");
    }

    if (
      await page.getByRole("button", { name: "Add a photo to complete" }).count()
    ) {
      await page.setInputFiles('input[aria-label="Choose job photos"]', {
        name: "job-photo.png",
        mimeType: "image/png",
        buffer: placeholderPhoto(),
      });
      // Wait for the thumbnail itself, not just the enabled button: the button
      // flips on the optimistic preview, while the caption promises a visible
      // photo. Both the panel and the freed Complete button need to be in frame.
      const thumbnail = page
        .getByRole("img", { name: /Selected job photo/i })
        .first();
      await thumbnail.waitFor({ timeout: 30_000 });
      await page
        .getByRole("button", { name: "Complete Job" })
        .waitFor({ timeout: 30_000 });
      // A phone screenshot is one screen, so bring the Photos panel into it —
      // the caption promises a visible thumbnail, and the sticky action bar
      // keeps Complete Job in frame regardless of scroll position.
      await thumbnail.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, "driver-job-photo");
    }

    const addNote = page.getByRole("button", { name: /^Add Note$/ });
    if (await addNote.count()) {
      await addNote.click();
      const draft = page.getByPlaceholder("Type a note…");
      await draft.fill(
        "Container placed on the north side of the lot, gate left as found.",
      );
      await page
        .getByRole("button", { name: "Save Note" })
        .scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, "driver-job-note");
      await page.getByRole("button", { name: "Cancel" }).click();
    }

    const dryRun = page.getByRole("button", { name: "Dry Run" });
    if (await dryRun.count()) {
      await dryRun.click();
      await page.getByText("Record dry run").waitFor();
      // An empty required field teaches nothing; the reason is the whole point
      // of the dialog.
      await page
        .locator('[role="dialog"] textarea')
        .first()
        .fill("Gate padlocked and no site contact answered.")
        .catch(() => {});
      await shot(page, "driver-dry-run", { fit: false });
      await closeModal(page);
    }
  }

  await open(page, "/driver/time-clock", "Time Clock", (p) =>
    p.getByRole("heading", { name: /Today's Time Entries/i }),
  );

  // The guide describes a running timer and the day's entries, so the driver is
  // put on the clock and through a break first. A clocked-out screen shows
  // 0:00:00 against an empty list and illustrates none of it.
  const clockIn = page.getByRole("button", { name: "Clock In" });
  if (await clockIn.count()) {
    await clockIn.click();
    await page.getByRole("button", { name: "Start Break" }).waitFor();
  }
  const startBreak = page.getByRole("button", { name: "Start Break" });
  if (await startBreak.count()) {
    await startBreak.click();
    await page.getByRole("button", { name: "End Break" }).waitFor();
    await page.getByRole("button", { name: "End Break" }).click();
    await page.getByRole("button", { name: "Start Break" }).waitFor();
  }
  await shot(page, "driver-time-clock");

  const changeTime = page.getByRole("button", { name: "Change Time" });
  if (await changeTime.count()) {
    await changeTime.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible" });
    // A blank form photographs as a blank form; fill the parts a driver types.
    await dialog
      .locator("textarea")
      .first()
      .fill("Clocked in at the yard but the app did not record it until 7:15.")
      .catch(() => {});
    await shot(page, "driver-time-request", { fit: false });
    await closeModal(page);
  }

  await open(page, "/driver/pre-trip", "Electronic Pre-Trip", (p) =>
    p.getByRole("button", { name: /Submit Inspection/i }),
  );
  await shot(page, "driver-pre-trip");

  await open(page, "/driver/sops", "SOPs", (p) =>
    p.getByRole("heading", { level: 2 }).first(),
  );
  await shot(page, "driver-sops");

  await open(page, "/driver/messages", "Messages");
  await shot(page, "driver-messages");

  await open(page, "/driver/profile", "Profile", (p) =>
    p.getByText(/Night Mode/i).first(),
  );
  await shot(page, "driver-profile", { fit: true, maxHeight: 900 });

  await context.close();
}

async function captureDispatcher(browser, dispatcher) {
  console.log("\nFor dispatchers");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await newPage(context);
  await signIn(page, dispatcher);

  await open(page, "/dispatcher/dashboard", "Operations Overview", (p) =>
    p.getByText("Needs Attention").first(),
  );
  await shot(page, "dispatch-overview", { fit: true });

  await open(page, "/dispatcher/jobs", "Jobs", (p) =>
    p.getByText(/Showing \d+ of \d+ jobs/).first(),
  );
  await shot(page, "dispatch-jobs", { fit: true });

  await page.getByRole("button", { name: /new job/i }).click();
  await page.getByText("Customer & Location").waitFor();
  await shot(page, "dispatch-new-job", { fit: false });
  await closeModal(page);

  // Scoped to the training row and exact: Playwright matches accessible names
  // by substring unless told otherwise, so a bare "View" also matches the
  // dashboard's "View details →" and "View all activity →" links.
  const viewJob = page
    .getByRole("row")
    .filter({ hasText: "#TRAINING-001" })
    .getByRole("link", { name: "View", exact: true })
    .first();
  if (await viewJob.count()) {
    await viewJob.click();
    await page
      .getByRole("heading", { level: 1, name: /^Job / })
      .waitFor({ timeout: 30_000 });
    await page.getByText("Assignments").waitFor();
    // The Job Status timeline arrives with the per-job refresh, a beat after the
    // panels around it. Waiting only for "Assignments" photographed an empty
    // Job Status card.
    await page
      .getByText("Created", { exact: true })
      .first()
      .waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "dispatch-job-details", { fit: true });

    const cancel = page.getByRole("button", { name: /^Cancel$/ });
    if (await cancel.count()) {
      await cancel.click();
      await page.getByText("Cancellation reason").waitFor();
      await shot(page, "dispatch-cancel-job", { fit: false });
      await closeModal(page);
    }
  }

  await open(page, "/dispatcher/customers", "Customers", (p) =>
    p.getByText("TRAINING", { exact: false }).first(),
  );
  await shot(page, "dispatch-customers", { fit: true });

  await page.getByRole("button", { name: /add customer/i }).click();
  await page.getByLabel("Name").waitFor();
  await shot(page, "dispatch-add-customer", { fit: false });
  await closeModal(page);

  await open(page, "/dispatcher/trucks", "Trucks", (p) =>
    p.getByText("TRAINING-TRUCK-01").first(),
  );
  await shot(page, "dispatch-trucks", { fit: true });

  await open(page, "/dispatcher/dumpsters", "Dumpsters", (p) =>
    p.getByText("TRAINING-DUMPSTER-01").first(),
  );
  await shot(page, "dispatch-dumpsters", { fit: true });

  await open(page, "/dispatcher/map", "Locations & AirTags", (p) =>
    p.getByText("Operational Locations").first(),
  );
  await shot(page, "dispatch-locations", { fit: true });

  await open(page, "/dispatcher/time-clock", "Time Clock", (p) =>
    p.getByRole("heading", { name: /Today's Time Entries/i }),
  );
  await shot(page, "dispatch-time-clock", { fit: true });

  await open(page, "/dispatcher/absence-calendar", "Absence Calendar", (p) =>
    p.getByText("Scheduling Accommodations").first(),
  );
  await shot(page, "dispatch-absence", { fit: true });

  await open(page, "/dispatcher/invoices", "Invoices", (p) =>
    p.getByText("Receivables").first(),
  );
  await shot(page, "dispatch-invoices", { fit: true });

  await open(page, "/dispatcher/reports", "Reports", (p) =>
    p.getByRole("button", { name: /Download CSV/i }).first(),
  );
  await shot(page, "dispatch-reports", { fit: true });

  await open(page, "/dispatcher/messages", "Messages");
  await shot(page, "dispatch-messages", { fit: true });

  await context.close();
}

async function captureAdministrator(browser, admin) {
  console.log("\nFor administrators");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await newPage(context);
  await signIn(page, admin);

  await open(page, "/management", "Management Overview", (p) =>
    p.getByText("Exceptions").first(),
  );
  await shot(page, "admin-management", { fit: true });

  // The practice driver proves the list has loaded, and is the row the
  // access-control screenshot below is taken from.
  await open(page, "/dispatcher/employees", "Employees", (p) =>
    p.getByText("TRAINING Driver").first(),
  );
  await shot(page, "admin-employees", { fit: true });

  await page.getByRole("button", { name: /add employee/i }).click();
  await page.getByRole("heading", { name: "Add Employee" }).waitFor();
  await page.getByLabel("Employee ID").waitFor();
  await shot(page, "admin-add-employee", { fit: false });
  await closeModal(page);

  const employee = page
    .getByRole("row")
    .filter({ hasText: "TRAINING Driver" })
    .getByRole("link")
    .first();
  const fallback = page.getByRole("link", { name: /access/i }).first();
  const target = (await employee.count()) ? employee : fallback;
  if (await target.count()) {
    await target.click();
    await page
      .getByRole("heading", { level: 1, name: "Employee Access Control" })
      .waitFor({ timeout: 30_000 });
    await page.getByText("Effective Access Preview").waitFor();
    await page.waitForTimeout(600);
    await shot(page, "admin-employee-access", { fit: true });
  }

  await open(page, "/dispatcher/settings", "Settings", (p) =>
    p.getByRole("tab", { name: "Company" }),
  );
  await page.getByLabel("Company Name").waitFor();
  await page.waitForTimeout(600);
  await shot(page, "admin-settings-company", { fit: true });

  for (const [tab, slug, ready] of [
    ["Driver Checklist", "admin-settings-checklist", /Published checklist/i],
    ["SOP Library", "admin-settings-sops", /Latest SOP version/i],
    ["Training Data", "admin-settings-training", /training dataset/i],
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.getByText(ready).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await shot(page, slug, { fit: true });
  }

  await context.close();
}

/* --------------------------------------------------------------- guardrail */

/**
 * A client-facing guide must not leak live records. Rather than guess from
 * rendered text, this asks the database directly: any customer, truck,
 * dumpster, or job on this project that the training dataset did not create is
 * something a screenshot could have caught.
 *
 * Employees are listed separately and always reported — the office screenshots
 * legitimately show the staff list, and whoever ships the guide should know
 * whose name is in it.
 */
async function reportNonTrainingRecords() {
  // Soft-deleted rows are invisible to every screen the guide photographs, so
  // counting them here would report a leak that no screenshot can contain.
  const scan = async (table, column) => {
    const { data, error } = await service
      .from(table)
      .select(`id,${column}`)
      .is("deleted_at", null);
    if (error) return { table, error: error.message, rows: [] };
    return {
      table,
      rows: data
        .filter((row) => !String(row[column] ?? "").includes("TRAINING"))
        .map((row) => row[column]),
    };
  };

  const results = await Promise.all([
    scan("customers", "name"),
    scan("trucks", "number"),
    scan("dumpsters", "code"),
    scan("jobs", "reference"),
  ]);

  const leaks = results.filter((result) => result.rows.length);
  if (leaks.length) {
    console.warn("\n! Records on this project that are NOT training data:");
    for (const { table, rows } of leaks)
      console.warn(`    ${table}: ${rows.slice(0, 8).join(", ")}${rows.length > 8 ? ` … +${rows.length - 8}` : ""}`);
    console.warn(
      "  These can appear in the office screenshots. Review those images before shipping.",
    );
  } else {
    console.log(
      "\n· customers, trucks, dumpsters, and jobs on this project are all TRAINING records",
    );
  }

  const { data: staff } = await service
    .from("users")
    .select("full_name,access_role,status")
    .eq("status", "active")
    .is("deleted_at", null);
  if (staff?.length)
    console.log(
      `· employee list shows ${staff.length} active people: ${staff.map((s) => s.full_name).join(", ")}`,
    );
}

/* -------------------------------------------------------------------- main */

async function main() {
  const { admin, driver, dispatcher } = accounts();
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const server = await ensureServer();
  const browser = await chromium.launch();
  try {
    await captureSignIn(browser, admin);
    await captureDriver(browser, driver);
    await captureDispatcher(browser, dispatcher);
    await captureAdministrator(browser, admin);
    await reportNonTrainingRecords();
  } finally {
    await browser.close();
    server?.kill();
  }

  await writeFile(
    join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, screenshots: captured }, null, 2)}\n`,
  );

  const files = await readdir(OUTPUT_DIR);
  const missing = ORDER.filter(
    (slug) => !captured.some((entry) => entry.name.endsWith(`-${slug}.png`)),
  );
  console.log(`\n${captured.length} of ${ORDER.length} screenshots written to ${OUTPUT_DIR}`);
  if (missing.length)
    console.warn(
      `! Not captured: ${missing.join(", ")}\n` +
        "  The guide references these; docs/client-user-guide.md will not build until they exist.",
    );
  else if (files.length !== ORDER.length + 1)
    console.warn(`! ${OUTPUT_DIR} holds unexpected extra files.`);
}

await main();
