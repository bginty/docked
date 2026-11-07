import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: [
    "pack-opening.test.ts",
    "pack-cinematic.test.ts",
    "nine-card-reveal.test.ts",
    "pack-cinema-v2.test.ts",
    "purchase-recovery.test.ts",
  ],
  timeout: 60000,
  workers: 1,
  use: {
    headless: true,
    channel:
      process.env.DOCKED_BROWSER_CHANNEL === "chrome" ? "chrome" : "msedge",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/android-v20/pack-browser.json" }],
  ],
});
