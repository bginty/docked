import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: ["pack-review-sharing.test.ts", "pack-navigation.test.ts"],
  timeout: 60000,
  workers: 1,
  outputDir: "test-results/native-share-v31",
  use: { headless: true, channel: "msedge", trace: "retain-on-failure" },
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "docs/qa/native-share-rounds-20261108/browser.json" },
    ],
  ],
});
