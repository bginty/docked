import { defineConfig } from "@playwright/test";
import path from "node:path";

// Deliberately separate from the public/DEMO browser suite. Never retain secrets in traces.
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: true,
  timeout: 120000,
  expect: { timeout: 30000 },
  globalSetup: "./setup.ts",
  outputDir: path.resolve("private-data/hosted-preview/artifacts"),
  preserveOutput: "never",
  reporter: [["./redacted-reporter.ts"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    "signup",
    "lifecycle",
    "community",
    "privileged",
    "revocation",
    "deletion",
    "closed-auth",
  ].map((name) => ({ name, testMatch: `${name}.spec.ts` })),
});
