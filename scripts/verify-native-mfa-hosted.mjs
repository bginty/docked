import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
assert.equal(d.state, "READY");
const domain = process.argv.includes("--domain");
const base = domain ? "https://docked.com.au" : d.url;
const share = domain
  ? null
  : JSON.parse(readFileSync("private-data/signup-candidate-access.json")).url;
if (share) assert.equal(new URL(share).origin, base);
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase();
const browser = await chromium.launch({ channel: "msedge" });
let before;
const report = {
  at: new Date().toISOString(),
  deployment: d.id,
  commit: d.commit,
  domain,
  checks: [],
  passed: false,
};
mkdirSync("docs/qa/native-mfa-renewal", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  await context.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: {},
    };
  });
  const page = await context.newPage();
  if (share) await page.goto(share);
  if (!domain)
    await context.route("**/*", async (route) => {
      if (
        new URL(route.request().url()).origin === base &&
        route.request().method() === "POST"
      )
        return route.fulfill({
          response: await route.fetch({
            headers: {
              ...route.request().headers(),
              origin: "https://docked.com.au",
            },
          }),
        });
      return route.continue();
    });
  let checks = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/app-session") checks++;
  });
  await page.goto(base + "/mfa");
  await expect(page.locator("html")).toHaveClass(/docked-native/);
  await expect(page.getByText("Sign in first", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("docked-app-resume")),
  );
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).pathname, "/mfa");
  assert.equal(checks, 0);
  report.checks.push(
    "Actual hosted native bridge preserves MFA screen during admission denial and resume; no gameplay-session request",
  );
  [before] =
    await db`select enabled from beta_private.friends_roster where user_id=${qa.id}::uuid`;
  assert.ok(before);
  await db.begin(async (tx) => {
    await tx`update beta_private.friends_roster set enabled=true where user_id=${qa.id}::uuid`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','native_auth_qa_started',${qa.id},'{"scope":"existing synthetic identity only"}'::jsonb)`;
  });
  const login = await context.request.post(base + "/api/auth", {
    headers: { Origin: "https://docked.com.au" },
    data: {
      action: "login",
      email: qa.email,
      password: qa.password,
      app: true,
    },
  });
  assert.equal(login.status(), 200);
  assert.equal((await login.json()).redirect, "/app");
  await page.goto(base + "/app");
  await page.waitForURL((u) => u.pathname === "/fantasy/play");
  await page.reload();
  await page.waitForURL((u) => u.pathname === "/fantasy/play");
  report.checks.push(
    "Existing synthetic ordinary member signs in and reloads Play without mandatory MFA",
  );
  await page.screenshot({
    path:
      "docs/qa/native-mfa-renewal/" +
      (domain ? "domain" : "candidate") +
      ".png",
  });
  const [owner] =
    await db`select beta_private.gameplay_mfa_required(u.id) required,beta_private.pending_beta_consent(u.id) renewal,(select count(*)::int from auth.mfa_factors f where f.user_id=u.id and f.status='verified') factors from auth.users u where lower(u.email)='support@docked.com.au'`;
  assert.equal(owner.required, true);
  assert.equal(owner.factors, 1);
  report.owner = {
    mfaEnforced: true,
    existingFactorPreserved: true,
    consentStillRequiresOwnerAction: owner.renewal,
  };
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  if (before)
    await db.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=${before.enabled} where user_id=${qa.id}::uuid`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','native_auth_qa_closed',${qa.id},'{"scope":"restored synthetic admission"}'::jsonb)`;
    });
  await browser.close();
  await db.end();
  writeFileSync(
    "docs/qa/native-mfa-renewal/" + (domain ? "domain" : "candidate") + ".json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
