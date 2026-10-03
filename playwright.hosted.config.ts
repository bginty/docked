import { defineConfig } from "@playwright/test";
import { ORIGIN, privateEvidence } from "./tests/hosted/s24/guard";

export default defineConfig({
  testDir: "tests/hosted/s24",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: `${privateEvidence}/runner`,
  preserveOutput: "never",
  reporter: [["./tests/hosted/s24/reporter.ts"]],
  use: {
    baseURL: ORIGIN,
    headless: true,
    ignoreHTTPSErrors: false,
    actionTimeout: 15000,
    navigationTimeout: 45000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      testMatch: "anonymous.spec.ts",
      use: { viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: "anonymous.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "authenticated",
      testMatch: "authenticated.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "member-evidence",
      testMatch: "member-evidence.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "timezone-evidence",
      testMatch: "timezone-evidence.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        timezoneId: "Australia/Sydney",
        locale: "en-AU",
      },
    },
  ],
});
