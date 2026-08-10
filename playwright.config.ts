import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  // CI must emit report files, not just annotations: a fully passing run writes
  // nothing to `test-results/`, so the release evidence artifact required by
  // docs/staging-verification.md would upload empty.
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/results.json" }],
      ]
    : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
});
