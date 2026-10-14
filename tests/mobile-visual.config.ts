import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "pack-opening.test.ts",
    "pack-cinematic.test.ts",
    "mobile-cleanup.test.ts",
  ],
  timeout: 60000,
  workers: 1,
  use: { channel: "msedge", headless: true },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/mobile-cleanup/browser-results.json" }],
  ],
  outputDir: "../tmp/mobile-browser-results",
});
