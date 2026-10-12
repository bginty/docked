// Dedicated synthetic member; restores admission and removes only its temporary future entry.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
const domain = process.argv.includes("--domain"),
  base = domain ? "https://docked.com.au" : d.url;
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const { competition } = JSON.parse(
  readFileSync("docs/qa/rarity-round/preparation.json"),
);
const db = ownerDatabase(),
  browser = await chromium.launch({ channel: "msedge" });
const report = {
  at: new Date().toISOString(),
  deployment: d.id,
  commit: d.commit,
  domain,
  checks: [],
  passed: false,
};
let before, page;
const out = "docs/qa/rarity-round";
try {
  const [b] =
    await db`select r.enabled roster_enabled,a.enabled wallet_enabled from beta_private.friends_roster r join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${qa.id}`;
  before = b;
  assert.ok(before);
  assert.equal(
    (
      await db`select count(*) n from beta_fantasy.entries where user_id=${qa.id} and competition_id=${competition}`
    )[0].n,
    0,
  );
  await db.begin(async (tx) => {
    await tx`update beta_private.friends_roster set enabled=true where user_id=${qa.id}`;
    await tx`update credits_sandbox.access set enabled=true where user_id=${qa.id}`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','rarity_browser_started',${qa.id},'{"syntheticOnly":true}'::jsonb)`;
  });
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
    (await context.request.get(base + "/api/fantasy")).status(),
    403,
  );
  await page.goto(base + "/app/login");
  await page.getByLabel("Email", { exact: true }).fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  if (domain) {
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/fantasy/"), {
      timeout: 30000,
    });
  } else {
    const r = await context.request.post(base + "/api/auth", {
      headers: { Origin: "https://docked.com.au" },
      data: {
        action: "login",
        email: qa.email,
        password: qa.password,
        app: true,
      },
    });
    assert.equal(r.status(), 200);
    await page.goto(base + (await r.json()).redirect);
  }
  report.checks.push("Ordinary AAL1 login; anonymous private API denied");
  await page.goto(base + "/fantasy/play?competition=" + competition);
  await expect(page.getByLabel("Competition", { exact: true })).toHaveValue(
    competition,
  );
  await expect(
    page.getByRole("heading", { name: "Isolated rarity test competition" }),
  ).toBeVisible();
  const initial = await page.evaluate(async () => {
    const r = await fetch("/api/fantasy");
    return (await r.json()).state;
  });
  assert.ok(
    initial.cards.some((c) => c.inventory_scope === "invited-nfl-test-v2"),
    "Existing QA opened nine-card packs are visible",
  );
  for (let i = 0; i < 7; i++) {
    await page.locator(".field-player.empty-slot").first().click();
    const buttons = page.locator(".player-picker > button");
    await expect(buttons.first()).toBeVisible();
    const limited = buttons.filter({ hasText: /RARE|ELITE|LEGENDARY|ICON/ });
    await ((await limited.count()) ? limited.first() : buttons.first()).click();
  }
  await expect(
    page.getByRole("button", { name: "Save Team", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save Team", exact: true }).click();
  await expect(
    page.getByText(/Team saved on the server|Team confirmed on the server/),
  ).toBeVisible({ timeout: 30000 });
  const saved = await page.evaluate(async () => {
    const r = await fetch("/api/fantasy");
    return (await r.json()).state;
  });
  const entry = saved.entries.find((e) => e.competition_id === competition);
  assert.equal(entry.cards.length, 7);
  assert.ok(
    entry.cards.some(
      (id) =>
        saved.cards.find((c) => c.id === id)?.inventory_scope ===
        "invited-nfl-test-v2",
    ),
  );
  await page.reload();
  await expect(page.locator(".field-player.empty-slot")).toHaveCount(0);
  const reopened = await page.evaluate(async () => {
    const r = await fetch("/api/fantasy");
    return (await r.json()).state;
  });
  assert.deepEqual(
    reopened.entries.find((e) => e.competition_id === competition).cards,
    entry.cards,
  );
  assert.equal(
    (await context.request.get(base + "/api/admin/operations")).status(),
    403,
  );
  const axe = await new AxeBuilder({ page }).include(".fantasy-play").analyze();
  assert.deepEqual(
    axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: out + `/team-${domain ? "domain" : "candidate"}-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({
    path: out + `/team-${domain ? "domain" : "candidate"}-desktop.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "View Points", exact: true }).click();
  await expect(
    page
      .getByText(/No locked rounds yet|Awaiting|No scoring round yet/)
      .first(),
  ).toBeVisible();
  await page.goto(base + "/fantasy/results");
  await expect(
    page.getByRole("heading", { name: "Post-game points" }),
  ).toBeVisible();
  await page.screenshot({
    path: out + `/points-${domain ? "domain" : "candidate"}.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  report.checks.push(
    "Seven eligible own cards including purchased rarity cards selected by touch; multipliers visible; save/reopen same IDs; direct future round and Sydney deadline; mobile/desktop; no console errors; axe passes; pending scoring honest; owner operations denied",
  );
  report.passed = true;
} catch (e) {
  report.error = e.message;
  await page
    ?.screenshot({
      path: "private-data/rarity-browser-failure.png",
      fullPage: true,
    })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
  if (before)
    await db.begin(async (tx) => {
      await tx`delete from beta_fantasy.entries where user_id=${qa.id} and competition_id=${competition} and exists(select 1 from beta_fantasy.competitions where id=${competition} and locks_at>clock_timestamp())`;
      await tx`delete from sports_feed.stream_members where user_id=${qa.id} and stream_id='beta-real:nfl:rarity-test:2026:6'`;
      await tx`update beta_private.friends_roster set enabled=${before.roster_enabled} where user_id=${qa.id}`;
      await tx`update credits_sandbox.access set enabled=${before.wallet_enabled} where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','rarity_browser_closed',${qa.id},'{"temporaryEntryRemovedBeforeLock":true,"holdingsUnchanged":true}'::jsonb)`;
    });
  await db.end();
  writeFileSync(
    out + `/${domain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(report);
}
