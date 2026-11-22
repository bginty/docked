import { defineConfig } from "@playwright/test";

// Synthetic HTTP fixtures only; never starts or authenticates to a live app.
export default defineConfig({
  testDir: "tests/browser",
  testMatch: ["owner-pack-awards.test.ts", "owner-rosters.test.ts"],
  timeout: 90000,
  workers: 1,
  outputDir: "test-results/owner-release",
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      args: ["--disable-dev-shm-usage"],
    },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/owner-release-results.json" }],
  ],
});
