import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: [
    "pack-navigation.test.ts",
    "purchase-recovery.test.ts",
    "ux-notification.test.ts",
  ],
  timeout: 60000,
  workers: 1,
  outputDir: "test-results/ux-refinement",
  use: { headless: true, channel: "msedge", trace: "retain-on-failure" },
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "docs/qa/ux-refinement-20261108/pack-regression.json" },
    ],
  ],
});
