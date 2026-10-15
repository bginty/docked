import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "jersey-refinement.test.ts",
    "pack-opening.test.ts",
    "pack-cinematic.test.ts",
  ],
  timeout: 120000,
  workers: 1,
  use: { channel: "msedge", headless: true },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/jersey-refinement/browser.json" }],
  ],
  outputDir: "../tmp/jersey-refinement-results",
});
