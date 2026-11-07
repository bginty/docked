import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "foil-pack-review.test.ts",
  workers: 1,
  timeout: 60000,
  outputDir: "test-results/foil-review",
  use: {
    headless: true,
    channel: "msedge",
    viewport: { width: 390, height: 844 },
    video: { mode: "on", size: { width: 390, height: 844 } },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/foil-pack-review-20261107/browser.json" }],
  ],
});
