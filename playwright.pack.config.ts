import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "pack-opening.test.ts",
  timeout: 60000,
  workers: 1,
  use: { headless: true, channel: "msedge" },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/android-v20/pack-browser.json" }],
  ],
});
