import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: `npm run dev -- --port ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
