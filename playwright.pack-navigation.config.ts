import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: ["pack-navigation.test.ts"],
  timeout: 60000,
  workers: 1,
  outputDir: "test-results/pack-navigation",
  use: {
    headless: true,
    channel: "msedge",
    video: process.env.DOCKED_NAV_RECORD
      ? { mode: "on", size: { width: 412, height: 915 } }
      : "retain-on-failure",
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `docs/qa/pack-navigation-20261107/${process.env.DOCKED_NAV_RECORD ? "recording" : "browser"}.json`,
      },
    ],
  ],
});
