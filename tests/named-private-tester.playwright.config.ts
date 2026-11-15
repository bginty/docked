import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./browser",
  testMatch: [
    "named-private-tester.test.ts",
    "customer-onboarding.test.ts",
    "auth-invitation.test.ts",
  ],
  // These six fixtures intercept every request. Redirect-page tests need a
  // running application and remain in the ordinary browser suite.
  grepInvert: /invitation confirmation requires a click/,
  timeout: 60000,
  workers: 1,
  use: {
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: resolve(
          "docs/qa/brenton-private-tester-20261115/browser-results.json",
        ),
      },
    ],
  ],
});
