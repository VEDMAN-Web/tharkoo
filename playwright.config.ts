import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "tests/setup/**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  globalSetup: "./tests/setup/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:4317",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Playwright starts webServer before globalSetup, so the memory server
  // lives in this command. It then runs node .next/standalone/server.js.
  webServer: {
    command: "node tests/setup/e2e-server.mjs",
    port: 4317,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
