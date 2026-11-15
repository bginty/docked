import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "../../tests/browser",
  testMatch: [
    "pack-opening.test.ts",
    "nine-card-reveal.test.ts",
    "pack-cinema-v2.test.ts",
    "purchase-recovery.test.ts",
  ],
  timeout: 90000,
  workers: 1,
  retries: 0,
  maxFailures: 5,
  outputDir: "../../private-data/overnight-audit-20261115/pack-traces",
  use: { headless: true, channel: "msedge", trace: "retain-on-failure" },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: resolve(
          process.env.DOCKED_AUDIT_RESULT ??
            "docs/qa/overnight-audit-20261115/pack-browser-results.json",
        ),
      },
    ],
  ],
});
