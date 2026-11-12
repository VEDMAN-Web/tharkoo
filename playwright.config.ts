import { defineConfig, devices } from "@playwright/test";

// End-to-end suite (H5.1). Runs against a PRODUCTION build served by tests/e2e/server.mjs
// (in-memory MongoDB, seeded). Build first: `npm run build`, then `npm run test:e2e`.
//
// To use a server you started yourself, set E2E_BASE_URL (and E2E_MONGO_URI_FILE if the
// role tests need to promote a user). Never point this at a real database.
const port = process.env.E2E_PORT || "4342";
const external = process.env.E2E_BASE_URL;
const baseURL = external || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: ".shots/e2e-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: external
    ? undefined
    : {
        command: "node tests/e2e/server.mjs",
        url: baseURL,
        timeout: 240_000,
        reuseExistingServer: true,
        env: { E2E_PORT: port },
      },
});
