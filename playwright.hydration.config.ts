import { defineConfig } from "@playwright/test";

// Actual ApiForm SSR/hydration fixture. Every navigation, script and submission
// is intercepted. No server, database, account credentials or email are needed.

export default defineConfig({
  testDir: "tests/browser-hydration",
  testMatch: "auth-form-hydration.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: "test-results/hydration",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/hydration-results.json" }],
  ],
  use: {
    baseURL: "http://auth-form.example.invalid",
    headless: true,
    trace: "retain-on-failure",
  },
});
