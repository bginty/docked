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
  readFileSync("docs/qa/seven-round/preparation.json"),
)[0];
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
const out = "docs/qa/seven-round";
try {
  const [b] =
    await db`select r.enabled roster_enabled,a.enabled wallet_enabled from beta_private.friends_roster r join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${qa.id}`;
  before = b;
  assert.ok(before);
  assert.equal(
    (
      await db`select count(*)::int n from beta_fantasy.entries where user_id=${qa.id} and competition_id=${competition}`
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
  await expect(
    page.getByRole("heading", { name: "Salary Cap", exact: true }),
  ).toBeVisible();
  const pick = async () => {
    await page
      .getByRole("button", { name: /Choose owned card/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const sort = page.getByLabel("Sort", { exact: true });
    if (await sort.locator('option[value="salary"]').count())
      await sort.selectOption("salary");
    const eligible = page.locator(".seven-candidate:not(:disabled)");
    await expect(eligible.first()).toBeVisible();
    await eligible.first().click();
  };
  for (let i = 0; i < 3; i++) await pick();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Your competition entry has not changed.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Choose owned card/ }),
  ).toHaveCount(7);
  await pick();
  await page.getByRole("button", { name: "Salary Cap", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Choose owned card/ }),
  ).toHaveCount(4);
  for (let i = 0; i < 4; i++) await pick();
  await page
    .getByRole("button", { name: "Enter Competition", exact: true })
    .click();
  await expect(
    page.getByText("Entry confirmed. Your submitted team is saved.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  const state = await page.evaluate(
    async () => (await (await fetch("/api/fantasy")).json()).state,
  );
  const entry = state.seven.entries.find(
    (e) => e.competition_id === competition,
  );
  assert.equal(entry.snapshot.length, 7);
  assert.equal(state.seven.entries.length, 1);
  assert.equal(
    state.seven.drafts.find((e) => e.competition_id === competition).selections
      .length,
    3,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Choose owned card/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Choose owned card/ }),
  ).toHaveCount(6);
  await page.screenshot({
    path: out + `/open-${domain ? "domain" : "candidate"}-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salary Cap", exact: true }).click();
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
    path: out + `/salary-${domain ? "domain" : "candidate"}-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({
    path: out + `/salary-${domain ? "domain" : "candidate"}-desktop.png`,
    fullPage: true,
  });
  const selections = entry.snapshot.map((c) => ({
    slot: c.slot,
    card: c.card_id,
  }));
  const replayRequest = {
    action: "seven_enter",
    request_id: crypto.randomUUID(),
    payload: {
      competition_id: competition,
      revision: entry.revision,
      selections,
    },
  };
  const parallel = await Promise.all(
    [1, 2].map(() =>
      context.request.post(base + "/api/fantasy", {
        headers: { Origin: "https://docked.com.au" },
        data: replayRequest,
      }),
    ),
  );
  assert.deepEqual(
    parallel.map((r) => r.status()),
    [200, 200],
  );
  const receipts = await Promise.all(parallel.map((r) => r.json()));
  assert.deepEqual(receipts[0].result, receipts[1].result);
  const competing = await Promise.all(
    [1, 2].map(() =>
      context.request.post(base + "/api/fantasy", {
        headers: { Origin: "https://docked.com.au" },
        data: {
          ...replayRequest,
          request_id: crypto.randomUUID(),
          payload: {
            ...replayRequest.payload,
            revision: receipts[0].result.revision,
          },
        },
      }),
    ),
  );
  assert.deepEqual(competing.map((r) => r.status()).sort(), [200, 409]);
  report.checks.push(
    "Concurrent identical submission replays one entry revision; competing distinct requests at the same revision yield one success and one conflict",
  );
  const reject = await context.request.post(base + "/api/fantasy", {
    headers: { Origin: "https://docked.com.au" },
    data: {
      action: "seven_draft",
      request_id: crypto.randomUUID(),
      payload: { competition_id: competition, revision: 0, selections: [] },
    },
  });
  assert.equal(reject.status(), 409);
  assert.equal(
    (await context.request.get(base + "/api/admin/operations")).status(),
    403,
  );
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
    "Ordinary member: incomplete draft, independent unsaved Open draft, seven-card Salary Cap entry, refresh restores selections, version conflict denied, private admin API denied, mobile/desktop screenshots, axe and console pass",
  );
  report.passed = true;
} catch (e) {
  report.error = e.message;
  await page
    ?.screenshot({
      path: "private-data/seven-browser-failure.png",
      fullPage: true,
    })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
  if (before)
    await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820342)`;
      await tx`insert into beta_fantasy.entry_revisions(competition_id,user_id,revision,action,snapshot,actor) select e.competition_id,e.user_id,(select coalesce(max(r.revision),0)+1 from beta_fantasy.entry_revisions r where r.competition_id=e.competition_id and r.user_id=e.user_id),'qa-cleanup-before-lock',e.snapshot,e.user_id from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=${qa.id} and c.rules->>'lineup_version' is not null and c.locks_at>clock_timestamp()`;
      await tx`delete from beta_fantasy.entries e using beta_fantasy.competitions c where e.competition_id=c.id and e.user_id=${qa.id} and c.rules->>'lineup_version' is not null and c.locks_at>clock_timestamp()`;
      await tx`delete from beta_fantasy.round_drafts where user_id=${qa.id}`;
      await tx`delete from sports_feed.stream_members where user_id=${qa.id} and stream_id like 'beta-real:nfl:seven:%'`;
      await tx`update beta_private.friends_roster set enabled=${before.roster_enabled} where user_id=${qa.id}`;
      await tx`update credits_sandbox.access set enabled=${before.wallet_enabled} where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','seven_browser_closed',${qa.id},'{"syntheticOnly":true,"holdingsUnchanged":true,"entryHistoryPreserved":true}'::jsonb)`;
    });
  await db.end();
  writeFileSync(
    out + `/${domain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(report);
}
