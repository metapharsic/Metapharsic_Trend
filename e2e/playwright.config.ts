import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright is the third layer of the QA stack, not the first.
 *
 * The static spec-diff (qa/tools/diff-spec.mjs) and the Jest contract suite
 * (web/__tests__/contracts) already cover response shape, scope rules and
 * pagination totals -- deterministically and in milliseconds. Everything here
 * is reserved for what only a real browser can observe: whether a dropdown
 * actually populates, whether a validation message actually appears, and
 * whether the number printed in a tab header matches the API's own total.
 */
export default defineConfig({
  // Root, not ./specs -- the login project's file lives in ./fixtures, and a
  // testDir of ./specs would silently collect zero setup tests.
  testDir: ".",
  testIgnore: ["**/node_modules/**"],
  outputDir: "../qa/reports/playwright-artifacts",
  // The app writes to a shared database; parallel workers would race fixtures.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["json", { outputFile: "../qa/reports/playwright-results.json" }],
    ["html", { outputFolder: "../qa/reports/playwright-html", open: "never" }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5555",
    // Screenshots and traces are what the QA agent attaches to a bug report,
    // so they are kept for failures rather than discarded.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /fixtures[\\/]auth\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: /specs[\\/].*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  // Set E2E_NO_SERVER=1 when you are already running `npm run dev` yourself.
  // Otherwise Playwright starts it -- but a cold `next dev` compile on Windows
  // routinely exceeds two minutes, hence the long timeout and piped output:
  // a silent 120s timeout tells you nothing about why the server never came up.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        cwd: "../web",
        // /login renders without a session; "/" redirects and can look like a
        // failed probe on a cold start.
        url: "http://localhost:5555/login",
        reuseExistingServer: true,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
