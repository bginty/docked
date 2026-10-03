import { defineConfig } from "@playwright/test";

// UI-only fixture. All authentication submissions are intercepted by the tests.
// A separate port and no server reuse prevent inheriting another preview's keys.
const environment: Record<string, string> = {};
for (const name of [
  "DATABASE_URL",
  "SUPABASE_SECRET_KEY",
  "PREVIEW_AUTH_CAPTURE_MODE",
  "PREVIEW_AUTH_PROJECT_REF",
  "ODDS_API_KEY",
  "RESULTS_API_KEY",
  "RESULTS_PROVIDER",
  "ODDS_RIGHTS_REFERENCE",
  "RESULTS_RIGHTS_REFERENCE",
  "EMAIL_API_KEY",
  "EMAIL_WEBHOOK_SECRET",
  "UNSUBSCRIBE_SECRET",
  "SMTP_PASSWORD",
  "PUSH_API_KEY",
  "STRIPE_SECRET_KEY",
  "MARKET_REFERENCE_CONFIG_JSON",
])
  environment[name] = "";
for (const name of [
  "DOCKED_HOSTED_PREVIEW",
  "DEMO_MODE",
  "REGISTRATION_ENABLED",
  "PUBLICATION_ENABLED",
  "FORWARD_PAPER_ENABLED",
  "SENDING_ENABLED",
  "ODDS_POLLING_ENABLED",
  "ADS_ENABLED",
  "AFFILIATES_ENABLED",
  "PAID_PLANS_ENABLED",
  "PRO_ENTITLEMENTS_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DEALS_ENABLED",
  "LEGAL_ENTITY_VERIFIED",
])
  environment[name] = "false";

export default defineConfig({
  testDir: "tests/browser-hydration",
  testMatch: "auth-form-hydration.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: "test-results/hydration",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/hydration-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3107",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3107/login",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      ...environment,
      PORT: "3107",
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      SITE_URL: "http://localhost:3107",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_fictional_hydration_ui_fixture",
      ODDS_MONTHLY_CREDIT_LIMIT: "0",
    },
  },
});
