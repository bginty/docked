// Existing synthetic QA only. No invitation, human credentials or real finance.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store.ts";
import { wallet } from "../src/core/credits-sandbox.ts";
const deployment = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
assert.equal(deployment.state, "READY");
assert.equal(deployment.effectiveTarget, "production");
const domain = process.argv.includes("--domain");
const replayOnly = process.argv.includes("--replay-only");
const priorAcceptance = replayOnly
  ? JSON.parse(readFileSync("docs/qa/android-v21/wallet-domain.json"))
  : null;
if (replayOnly) {
  assert.equal(domain, true);
  assert.equal(priorAcceptance.commit, deployment.commit);
  assert.ok(
    priorAcceptance.checks.some((c) =>
      c.startsWith("Persisted purchase survived"),
    ),
  );
}
const base = domain ? "https://docked.com.au" : deployment.url;
const approvedShare =
  !domain && process.argv.includes("--approved-private-share")
    ? JSON.parse(readFileSync("private-data/signup-candidate-access.json"))
    : null;
if (approvedShare) assert.equal(new URL(approvedShare.url).origin, base);
const ownerHeaders = domain
  ? {}
  : { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN };
if (!domain && !approvedShare) {
  assert.ok(
    process.env.VERCEL_OIDC_TOKEN,
    "Use authenticated Vercel env run; never share owner access",
  );
  const probe = await fetch(base + "/api/beta-release", {
    headers: ownerHeaders,
    redirect: "manual",
  });
  assert.equal(
    probe.status,
    200,
    "Authenticated candidate access required before QA mutation",
  );
}
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase(),
  store = new CreditsSandboxStore(db);
const report = {
  at: new Date().toISOString(),
  deployment: deployment.id,
  commit: deployment.commit,
  domain,
  checks: [],
  passed: false,
};
const out = "docs/qa/android-v21";
mkdirSync(out, { recursive: true });
let browser, rosterBefore, accessBefore, page;
try {
  const [roster] =
    await db`select r.enabled from beta_private.friends_roster r join auth.users u on u.id=r.user_id where u.id=${qa.id} and u.email=${qa.email} and r.email=${qa.email}`;
  assert.ok(roster);
  rosterBefore = roster.enabled;
  [accessBefore] =
    await db`select * from credits_sandbox.access where user_id=${qa.id}::uuid`;
  await db.begin(async (tx) => {
    await tx`update beta_private.friends_roster set enabled=true where user_id=${qa.id}`;
    await tx`insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note) values(${qa.id},'tester','Synthetic QA',true,'Owner-authorised automated hosted test; disable after acceptance; no external invitation') on conflict(user_id) do update set enabled=true`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','test_wallet_qa_started',${qa.id},'{"scope":"existing synthetic identity only"}'::jsonb)`;
  });
  const snapshot = async () =>
    JSON.stringify(
      await db`select (select jsonb_agg(to_jsonb(p) order by id) from beta_public.profiles p where id in (${qa.id},'ef641248-67be-4c32-9b12-9205bfcee15b','623d1e69-d0f3-493f-9713-108e8c21469a')) profiles,(select jsonb_agg(to_jsonb(c) order by id) from beta_fantasy.cards c where owner_id in (${qa.id},'ef641248-67be-4c32-9b12-9205bfcee15b','623d1e69-d0f3-493f-9713-108e8c21469a')) cards`,
    );
  const before = await snapshot();
  const barryBefore = wallet(
    await store.read(),
    "ef641248-67be-4c32-9b12-9205bfcee15b",
  );
  assert.ok(
    replayOnly || wallet(await store.read(), qa.id).spendable >= 900,
    "Existing synthetic QA fixture needs test balance; no human grants",
  );
  browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  if (!domain) {
    page = await context.newPage();
    if (approvedShare) await page.goto(approvedShare.url);
    await context.route("**/*", async (route) => {
      const headers = { ...route.request().headers() };
      delete headers["x-vercel-trusted-oidc-idp-token"];
      if (!approvedShare && new URL(route.request().url()).origin === base)
        Object.assign(headers, ownerHeaders);
      if (
        new URL(route.request().url()).origin === base &&
        route.request().method() === "POST"
      ) {
        headers.origin = "https://docked.com.au";
        return route.fulfill({ response: await route.fetch({ headers }) });
      }
      return route.continue({ headers });
    });
  } else page = await context.newPage();
  const anon = await context.request.get(base + "/api/test-wallet", {
    headers: approvedShare ? {} : ownerHeaders,
  });
  assert.equal(anon.status(), 403);
  await page.goto(base + "/app/login");
  await page.getByLabel("Email", { exact: true }).fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  if (domain) {
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/fantasy/"), {
      timeout: 30000,
    });
  } else {
    const login = await context.request.post(base + "/api/auth", {
      headers: {
        ...(approvedShare ? {} : ownerHeaders),
        Origin: "https://docked.com.au",
      },
      data: {
        action: "login",
        email: qa.email,
        password: qa.password,
        app: true,
      },
    });
    assert.equal(login.status(), 200);
    await page.goto(base + (await login.json()).redirect);
  }
  report.checks.push(
    "Ordinary password login, no mandatory MFA, anonymous wallet denied",
  );
  await page.goto(base + "/fantasy/test-wallet");
  await expect(
    page.getByRole("heading", { name: "Test wallet", exact: true }),
  ).toBeVisible();
  const get = async () =>
    page.evaluate(async () => {
      const r = await fetch("/api/test-wallet");
      return { status: r.status, body: await r.json() };
    });
  const initial = await get();
  assert.equal(initial.status, 200);
  assert.equal(initial.body.state.member, qa.id);
  assert.equal(initial.body.state.ownerReport, null);
  assert.equal(initial.body.state.wallet.withdrawable, 0);
  const post = async (command) =>
    page.evaluate(async (command) => {
      const r = await fetch("/api/test-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: crypto.randomUUID(), command }),
      });
      return { status: r.status, body: await r.json() };
    }, command);
  for (const command of [
    {
      kind: "promotion",
      member: qa.id,
      amount: 100000,
      campaign: "forbidden",
      reason: "forbidden ordinary member operation",
      confirmed: true,
      redeemable: false,
    },
    { kind: "withdraw", amount: 100 },
    { kind: "open-pack", entitlement: "another-members-entitlement" },
  ])
    assert.notEqual((await post(command)).status, 200);
  report.checks.push(
    "Owner issuance, withdrawal and foreign receipt denied; no owner reports or foreign wallet",
  );
  let afterBuy = initial;
  if (!replayOnly) {
    page.on("dialog", (d) => d.accept());
    let dropped = false;
    await page.route("**/api/test-wallet", async (route) => {
      if (
        !dropped &&
        route.request().method() === "POST" &&
        route.request().postDataJSON()?.command?.kind === "buy-pack"
      ) {
        dropped = true;
        const response = await route.fetch({
          headers: {
            ...route.request().headers(),
            origin: domain ? base : "https://docked.com.au",
          },
        });
        if (response.status() !== 200) {
          await route.fulfill({ response });
          return;
        }
        await route.abort("failed");
      } else await route.fallback();
    });
    await page
      .getByRole("button", { name: "Buy Standard · nine cards", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry pending transaction" }),
    ).toBeEnabled({ timeout: 30000 });
    await page.reload();
    await page
      .getByRole("button", { name: "Retry pending transaction" })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry pending transaction" }),
    ).toHaveCount(0, { timeout: 30000 });
    afterBuy = await get();
    assert.equal(
      afterBuy.body.state.wallet.spendable,
      initial.body.state.wallet.spendable - 900,
    );
    assert.equal(
      afterBuy.body.state.packs.length,
      initial.body.state.packs.length + 1,
    );
    report.checks.push(
      "Persisted purchase survived response loss and reload: same operation, one 900 debit",
    );
  } else {
    report.checks.push(
      "Persisted purchase survived response loss and reload: same operation, one 900 debit (previous attempt verified before video-only failure; no new purchase on replay)",
    );
  }
  const targetPack = replayOnly
    ? initial.body.state.packs.find((p) => p.receipt?.cards.length === 9)
    : afterBuy.body.state.packs.find(
        (p) => !initial.body.state.packs.some((old) => old.id === p.id),
      );
  assert.equal(targetPack?.status, replayOnly ? "OPENED" : "SEALED");
  await page
    .locator(`[data-pack-id="${targetPack.id}"]`)
    .getByRole("button", {
      name: replayOnly ? "Replay saved pack" : "Open pack",
      exact: true,
    })
    .click();
  if (!replayOnly)
    await page
      .getByRole("button", { name: "Open pack seal", exact: true })
      .click();
  await expect(page.locator(".pack-case")).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(6500);
  const opened = await get();
  const pack = opened.body.state.packs.find((p) => p.id === targetPack.id);
  assert.equal(pack.status, "OPENED");
  assert.equal(pack.receipt.cards.length, 9);
  const same = await post({ kind: "open-pack", entitlement: pack.id });
  assert.equal(same.status, 200);
  assert.deepEqual(same.body.result, pack.receipt);
  assert.equal(
    same.body.state.wallet.spendable,
    afterBuy.body.state.wallet.spendable,
  );
  report.checks.push(
    "Actual persisted award; repeat opening returns same receipt without debit",
  );
  await page.screenshot({
    path: out + `/wallet-${domain ? "domain" : "candidate"}-mobile.png`,
  });
  const axe = await new AxeBuilder({ page }).include("dialog").analyze();
  assert.deepEqual(axe.violations, []);
  await page.getByRole("button", { name: "Reveal next", exact: true }).click();
  await expect(page.getByText(/Card 2 of 9/)).toBeVisible();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.reload();
  await page
    .locator(`[data-pack-id="${pack.id}"]`)
    .getByRole("button", { name: "Replay saved pack", exact: true })
    .click();
  await expect(page.getByText(/Card 2 of 9/)).toBeVisible();
  await page.getByRole("button", { name: "Reveal all", exact: true }).click();
  await expect(page.locator(".pack-summary li")).toHaveCount(9);
  await page.screenshot({ path: out + "/nine-card-summary.png" });
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.reload();
  assert.equal(
    (await get()).body.state.cards.find(
      (c) => c.id === pack.receipt.cards[0].id,
    ).owner,
    qa.id,
  );
  await page.screenshot({
    path: out + `/wallet-${domain ? "domain" : "candidate"}-desktop.png`,
  });
  report.checks.push(
    "Mobile/desktop layout, accessible card dialog, owned card persists after reopening",
  );
  if (domain) {
    const recorded = await browser.newContext({
      storageState: await context.storageState(),
      viewport: { width: 412, height: 915 },
      recordVideo: {
        dir: out + "/raw-video",
        size: { width: 412, height: 915 },
      },
    });
    const film = await recorded.newPage();
    await film.goto(base + "/fantasy/test-wallet");
    await film
      .locator(`[data-pack-id="${pack.id}"]`)
      .getByRole("button", { name: "Replay saved pack", exact: true })
      .click();
    // storageState includes the completed local reveal progress from above.
    await expect(film.locator(".pack-summary li")).toHaveCount(9);
    await film
      .getByRole("button", {
        name: "Replay saved result · no new cards",
        exact: true,
      })
      .click();
    await film.waitForTimeout(6500);
    for (let i = 0; i < 3; i++) {
      await film
        .getByRole("button", { name: "Reveal next", exact: true })
        .click();
      await film.waitForTimeout(500);
    }
    await film.getByRole("button", { name: "Reveal all", exact: true }).click();
    await film.waitForTimeout(1000);
    await recorded.close();
    await film.video().saveAs(out + "/Docked-v21-nine-card-reveal.webm");
  }
  assert.equal(await snapshot(), before);
  assert.deepEqual(
    wallet(await store.read(), "ef641248-67be-4c32-9b12-9205bfcee15b"),
    barryBefore,
  );
  report.checks.push(
    "Owner/Barry normal cards and profiles unchanged; Barry financial balance unchanged by QA",
  );
  report.passed = true;
} catch (error) {
  if (page)
    await page
      .screenshot({ path: "private-data/wallet-v21-failure.png" })
      .catch(() => {});
  report.error = error.message;
  throw error;
} finally {
  await browser?.close();
  if (rosterBefore !== undefined)
    await db.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=${rosterBefore} where user_id=${qa.id}`;
      await tx`update credits_sandbox.access set enabled=${accessBefore?.enabled ?? false} where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','test_wallet_qa_closed',${qa.id},'{"scope":"restored synthetic admission; permanent test receipts retained"}'::jsonb)`;
    });
  await db.end();
  writeFileSync(
    out + `/wallet-${domain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
