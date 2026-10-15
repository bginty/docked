import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./browser",
  testMatch: ["premium-v3.test.ts", "pack-opening.test.ts", "pack-cinematic.test.ts"],
  timeout: 60000,
  workers: 1,
  use: { channel: "msedge", headless: true },
  reporter: [
    ["list"],
    ["json", { outputFile: resolve("docs/qa/premium-v3/browser.json") }],
  ],
  outputDir: "tmp/premium-v3-browser",
});
