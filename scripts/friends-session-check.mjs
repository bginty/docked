// Existing synthetic QA only: no email/password change or invitation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const base = "https://docked.com.au";
const browser = await chromium.launch();
const report = {
  at: new Date().toISOString(),
  scope:
    "Browser cookie persistence after context close/reopen, not Android process persistence",
  passed: false,
};
try {
  let context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  let page = await context.newPage();
  await page.goto(base + "/app/login");
  await page.getByLabel("Email", { exact: true }).fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/fantasy/play");
  await page.getByRole("button", { name: "Pick Team", exact: true }).waitFor();
  const state = await context.storageState();
  await context.close();
  context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    storageState: state,
  });
  page = await context.newPage();
  await page.goto(base + "/app");
  await page.getByRole("button", { name: "Pick Team", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/fantasy/play");
  const response = await context.request.get(base + "/api/fantasy");
  assert.equal(response.status(), 200);
  assert.equal((await response.json()).state.user_id, qa.id);
  for (const tab of ["play", "cards", "market", "social", "profile"]) {
    await page.goto(base + "/fantasy/" + tab);
    await page
      .locator(".fantasy-screen, .fantasy-market-panel")
      .first()
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/qa/customer-onboarding/friends-${tab}-viewport.png`,
    });
  }
  report.passed = true;
  await context.close();
} finally {
  await browser.close();
  writeFileSync(
    "docs/qa/friends-cutover/session-reopen.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report));
