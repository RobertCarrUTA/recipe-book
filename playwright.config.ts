import { defineConfig, devices } from "@playwright/test";
import { chromium } from "playwright";
import { findBrowserExecutable } from "./scripts/browser-executable.mjs";

const port = Number(process.env.RECIPE_BOOK_TEST_PORT || 4177);
const baseURL = process.env.RECIPE_BOOK_TEST_URL || `http://127.0.0.1:${port}/`;
const executablePath = process.env.CI
  ? undefined
  : (await findBrowserExecutable({ playwright: { chromium } })) || undefined;
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright",
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{projectName}-{platform}/{arg}{ext}",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : 2,
  retries: 0,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env.RECIPE_BOOK_REPORT || "test-results/e2e-results.json",
      },
    ],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
    ...(process.env.CROSS_BROWSER
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
  webServer: process.env.RECIPE_BOOK_TEST_URL
    ? undefined
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30000,
      },
});
