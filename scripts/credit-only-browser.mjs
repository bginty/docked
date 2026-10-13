// Existing isolated QA login; one idempotent QA pack purchase, no human actions.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store.ts";
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
const domain = process.argv.includes("--domain"),
  base = domain ? "https://docked.com.au" : d.url;
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const sql = ownerDatabase(),
  browser = await chromium.launch({ channel: "msedge" });
const report = {
  at: new Date().toISOString(),
  deployment: d.id,
  commit: d.commit,
  domain,
  passed: false,
  checks: [],
};
let before, page;
try {
  [before] =
    await sql`select r.enabled roster,a.enabled wallet from beta_private.friends_roster r join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${qa.id}`;
  assert.ok(before);
  await sql.begin(async (tx) => {
    await tx`update beta_private.friends_roster set enabled=true where user_id=${qa.id}`;
    await tx`update credits_sandbox.access set enabled=true where user_id=${qa.id}`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','credit_only_browser_started',${qa.id},'{"syntheticOnly":true}'::jsonb)`;
  });
  await new CreditsSandboxStore(sql).execute(
    { id: "qa-operator", role: "reviewer", aal: "aal2" },
    "credit-only-browser-grant-900",
    {
      kind: "promotion",
      member: qa.id,
      amount: 900,
      campaign: "credit-only-browser-qa",
      reason:
        "Dedicated synthetic browser fixture; nonwithdrawable, no human grant",
      confirmed: true,
      redeemable: false,
    },
  );
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    timezoneId: "Australia/Sydney",
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (!domain) {
    const share = JSON.parse(
      readFileSync("private-data/signup-candidate-access.json"),
    ).url;
    assert.equal(new URL(share).origin, base);
    await page.goto(share);
    await context.route("**/*", async (route) => {
      const req = route.request();
      if (new URL(req.url()).origin === base && req.method() === "POST")
        return route.fulfill({
          response: await route.fetch({
            headers: { ...req.headers(), origin: "https://docked.com.au" },
          }),
        });
      await route.continue();
    });
  }
  assert.equal(
    (await context.request.get(base + "/api/test-wallet")).status(),
    403,
  );
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
  await page.goto(base + (await login.json()).redirect);
  await page.goto(base + "/fantasy/test-wallet");
  await expect(
    page.getByRole("heading", { name: "Test wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("100 Docked Credits = A$1.00.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy credits · unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Withdraw · unavailable" }),
  ).toBeDisabled();
  const initial = (
    await (await context.request.get(base + "/api/test-wallet")).json()
  ).state;
  assert.equal(initial.ownerReport, null);
  assert.equal(initial.wallet.withdrawable, 0);
  assert.equal(
    (await context.request.get(base + "/api/test-wallet?format=csv")).status(),
    403,
  );
  const post = (command, request = randomUUID()) =>
    context.request.post(base + "/api/test-wallet", {
      headers: { Origin: "https://docked.com.au" },
      data: { request, command },
    });
  for (const command of [
    { kind: "credit-deposit", cents: 1000 },
    {
      kind: "withdraw",
      amount: 1,
      beneficiary: qa.id,
      confirmed: true,
      policy: initial.policy,
    },
    {
      kind: "promotion",
      member: qa.id,
      amount: 100000,
      campaign: "forged",
      reason: "Reject browser issuance attempt",
      confirmed: true,
      redeemable: false,
    },
    {
      kind: "swap-window",
      start: Date.now() + 60000,
      end: Date.now() + 120000,
      reason: "Reject member window configuration",
    },
  ])
    assert.equal((await post(command)).status(), 400);
  report.checks.push(
    "Ordinary login, private API and owner CSV restrictions; no member deposit, withdrawal, grant or fee configuration path",
  );
  const p = initial.products.find((p) => p.id === "standard-nine-test-v1");
  const buy = {
    kind: "buy-pack",
    product: p.id,
    configuration: p.version,
    confirmed: true,
    policy: initial.policy,
  };
  // Fixed key: reruns retrieve this same QA pack rather than buy another.
  const request = "ae91d7f8-ec15-435c-a9e4-290b77c6b1e8";
  const r = await post(buy, request);
  assert.equal(r.status(), 200, r.status() === 200 ? "" : await r.text());
  const result = await r.json();
  assert.equal(result.result.cards, 9);
  assert.equal((await post(buy, request)).status(), 200);
  const opened = await post({ kind: "open-pack", entitlement: request });
  assert.equal(opened.status(), 200);
  const receipt = (await opened.json()).result;
  assert.equal(receipt.cards.length, 9);
  const reopened = await post({ kind: "open-pack", entitlement: request });
  assert.deepEqual((await reopened.json()).result, receipt);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Test wallet", exact: true }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include(".test-wallet")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: `docs/qa/credit-only/wallet-mobile-${domain ? "domain" : "candidate"}.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: `docs/qa/credit-only/wallet-desktop-${domain ? "domain" : "candidate"}.png`,
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  await page.goto(base + "/fantasy/market");
  await expect(page.getByRole("heading", { name: "Docked packs", exact: true })).toBeVisible();
  assert.ok(!(await page.locator("body").innerText()).includes("AUD $2.50"));
  assert.equal((await context.request.get(base + "/api/fantasy/market-proposal")).status(), 410);
  report.checks.push(
    "Dedicated QA nine-card credit purchase, repeated request and repeated opening restore same receipt; reload, mobile/desktop, axe, no overflow or console errors",
  );
  report.passed = true;
} catch (e) {
  report.error = e.message;
  throw e;
} finally {
  await browser.close();
  if (before)
    await sql.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=${before.roster} where user_id=${qa.id}`;
      await tx`update credits_sandbox.access set enabled=${before.wallet} where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','credit_only_browser_closed',${qa.id},'{"syntheticOnly":true,"humanHoldingsUnchanged":true}'::jsonb)`;
    });
  await sql.end();
  writeFileSync(
    `docs/qa/credit-only/${domain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
}
