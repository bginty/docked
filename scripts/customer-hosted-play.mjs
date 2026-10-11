// Same synthetic QA identity, no password reset, owner mutations or messages.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const deployment = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json"),
);
assert.equal(deployment.effectiveTarget, "preview");
assert.equal(deployment.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
const base = deployment.url,
  token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token);
const dir = "private-data/customer-hosted-qa",
  qa = JSON.parse(readFileSync(dir + "/identity.json"));
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase(),
  report = {
    at: new Date().toISOString(),
    deployment: deployment.id,
    scope:
      "Hosted browser, synthetic ordinary-member account; prospective draft removed with audit before lock, not a real competition entrant or physical-device acceptance.",
    checks: [],
    passed: false,
  };
let browser,
  context,
  activated = false;
const check = (s) => {
  report.checks.push(s);
  console.log(s);
};
try {
  assert.equal(
    (await db`select enabled from beta_private.friends_control`)[0].enabled,
    false,
  );
  assert.equal(
    (await db`select testers_enabled from beta_private.admission_control`)[0]
      .testers_enabled,
    false,
  );
  await db.begin(async (tx) => {
    await tx`update beta_private.friends_control set enabled=true,readiness_evidence='Protected ordinary QA gameplay acceptance only; external release closed',approved_by='qa-operator',approved_at=clock_timestamp()`;
    await tx`update beta_private.admission_control set testers_enabled=true`;
  });
  activated = true;
  browser = await chromium.launch();
  context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  await context.route("**/*", (r) => {
    const headers = { ...r.request().headers() };
    delete headers["x-vercel-trusted-oidc-idp-token"];
    if (new URL(r.request().url()).origin === base)
      headers["x-vercel-trusted-oidc-idp-token"] = token;
    return r.continue({ headers });
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push({path:new URL(page.url()).pathname,message:e.message}));
  await page.goto(base + "/app/login");
  await page.getByLabel('Email',{exact:true}).fill(qa.email);
  await page.getByLabel('Password',{exact:true}).fill(qa.password);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page
    .getByRole("button", { name: "Pick Team", exact: true })
    .waitFor({ timeout: 30000 });
  const state = () =>
    page.evaluate(async () => {
      const r = await fetch("/api/fantasy");
      if (!r.ok) throw Error("State unavailable");
      return (await r.json()).state;
    });
  const initial = await state();
  assert.equal(initial.user_id, qa.id);
  assert.equal(initial.cards.length, 10);
  assert.equal(initial.nfl_beta, true);
  assert.ok(
    initial.competitions.some(
      (c) => c.sport === "nfl" && Date.parse(c.locks_at) > Date.now(),
    ),
  );
  check(
    "Original-password ordinary login without MFA; owned NFL collection and future deadline served from hosted backend",
  );
  if (initial.team_name) await page.getByText('Edit team name',{exact:true}).click();
  await page.getByLabel('Team name',{exact:true}).fill(initial.team_name==='QA Harbour Team'?'QA Harbour Team Two':'QA Harbour Team');
  const [named] = await Promise.all([page.waitForResponse(r=>r.url()===base+'/api/fantasy'&&r.request().method()==='POST'),page.getByRole('button',{name:'Save name',exact:true}).click()]);
  assert.equal(named.status(),200);const persistedName=(await state()).team_name;assert.match(persistedName,/^QA Harbour Team/);
  await page.reload();await page.getByRole('heading',{name:persistedName,exact:true}).waitFor();
  check('Chosen team name persists on the server and restores after refresh');
  for (const position of ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]) {
    await page
      .getByRole("button", { name: new RegExp("^Choose " + position + " ") })
      .first()
      .click();
    await page.locator(".player-picker button").first().click();
  }
  const save = async () => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url() === base + "/api/fantasy" && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Save Team", exact: true }).click(),
    ]);
    assert.equal(response.status(), 200, "Server lineup save");
  };
  await save();
  const saved = await state();
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.entries[0].cards.length, 7);
  report.deadline = saved.competitions.find(
    (c) => c.id === saved.entries[0].competition_id,
  ).locks_at;
  await page.reload();
  await page.getByRole("button", { name: "Pick Team", exact: true }).waitFor();
  assert.deepEqual((await state()).entries[0].cards, saved.entries[0].cards);
  await page.screenshot({
    path: "docs/qa/customer-onboarding/hosted-team.png",
    fullPage: true,
  });
  check(
    "Seven-player owned NFL team selected by taps, saved and restored after refresh",
  );
  const previousQb = saved.cards.find(
    (c) => c.position === "QB" && saved.entries[0].cards.includes(c.id),
  );
  await page
    .getByRole("button", { name: /, QB\. Select player options/ })
    .first()
    .click();
  await page
    .locator(".player-picker button")
    .filter({ hasNotText: previousQb.name })
    .first()
    .click();
  await save();
  assert.notDeepEqual((await state()).entries[0].cards, saved.entries[0].cards);
  check("Free eligible replacement persists before server deadline");
  await page.getByRole("button", { name: "View Points", exact: true }).click();
  await page.screenshot({
    path: "docs/qa/customer-onboarding/hosted-pending-points.png",
    fullPage: true,
  });
  assert.equal((await state()).results.length, 0);
  check(
    "Unplayed member round remains pending without fabricated points or rankings",
  );
  for (const tab of ["cards", "market", "social", "profile"]) {
    await page.goto(base + "/fantasy/" + tab);
    await page.locator(".fantasy-screen").waitFor({ timeout: 30000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      tab + " overflow",
    );
    await page.screenshot({
      path: `docs/qa/customer-onboarding/hosted-${tab}.png`,
      fullPage: true,
    });
  }
  const denied = await context.request.get(base + "/api/admin/operations", {
    headers: { "x-vercel-trusted-oidc-idp-token": token },
  });
  assert.ok([401, 403, 404].includes(denied.status()));
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.error = String(e.message).replaceAll(token, "[redacted]");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  if (activated) await import("./close-customer-qa.mjs");
  report.externalAdmissionOpen = false;
  writeFileSync(
    "docs/qa/customer-onboarding/hosted-customer-play.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await db.end();
}
