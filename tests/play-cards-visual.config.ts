import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "play-cards-redesign.test.ts",
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
    ["json", { outputFile: resolve("docs/qa/play-cards/browser-results.json") }],
  ],
  outputDir: resolve("tmp/play-cards-results-final"),
});
