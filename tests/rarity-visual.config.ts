import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "rarity-frames.test.ts",
    "pack-opening.test.ts",
    "pack-cinematic.test.ts",
    "mobile-cleanup.test.ts",
  ],
  timeout: 120000,
  workers: 1,
  use: { channel: "msedge", headless: true },
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/qa/rarity-frames/browser-results.json" }],
  ],
  outputDir: "../tmp/rarity-frame-results",
});
