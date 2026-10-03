import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "public-smoke.spec.ts",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 240000,
  forbidOnly: true,
  outputDir: "private-data/hosted-preview/public-smoke-artifacts",
  preserveOutput: "never",
  reporter: [["./public-smoke-reporter.ts"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
