import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
process.env.DOCKED_VISUAL_EVIDENCE = "docs/qa/reveal-stability";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "reveal-stability.test.ts",
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
    [
      "json",
      { outputFile: resolve("docs/qa/reveal-stability/browser-results.json") },
    ],
  ],
  outputDir: resolve("tmp/reveal-stability-results"),
});
