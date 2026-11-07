import { defineConfig } from "@playwright/test";
process.env.FOIL_QA_OUTPUT = "docs/qa/foil-pack-rollout-20261107";
process.env.DOCKED_VISUAL_EVIDENCE = "docs/qa/foil-pack-rollout-20261107";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: [
    "foil-rollout.test.ts",
    "foil-pack-release.test.ts",
    "purchase-recovery.test.ts",
    "nine-card-reveal.test.ts",
  ],
  workers: 1,
  timeout: 90000,
  outputDir: "test-results/foil-rollout",
  use: {
    headless: true,
    channel: "msedge",
    viewport: { width: 390, height: 844 },
    video: { mode: "retain-on-failure" },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/qa/foil-pack-rollout-20261107/browser.json" }],
  ],
});
