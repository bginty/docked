// Existing synthetic ordinary QA account only. No messages, new admission or awards.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import AxeBuilder from "@axe-core/playwright";
const deployment = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
assert.equal(deployment.state, "READY");
assert.equal(deployment.effectiveTarget, "production");
const onDomain = process.argv.includes("--domain");
const base = onDomain ? "https://docked.com.au" : deployment.url;
const token = process.env.VERCEL_OIDC_TOKEN;
const privateAccess =
  !onDomain &&
  JSON.parse(readFileSync("private-data/signup-candidate-access.json"));
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase();
let browser;
let rosterBefore;
mkdirSync("docs/qa/android-v19", { recursive: true });
const report = {
  at: new Date().toISOString(),
  deployment: deployment.id,
  onDomain,
  checks: [],
  passed: false,
};
try {
  const [roster] =
    await db`select r.enabled from beta_private.friends_roster r join auth.users u on u.id=r.user_id where r.user_id=${qa.id} and u.email=${qa.email} and r.email=${qa.email}`;
  assert.ok(roster, "Exact existing synthetic roster identity required");
  rosterBefore = roster.enabled;
  if (!rosterBefore)
    await db.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=true where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','pack_reveal_qa_started',${qa.id},'{"reason":"Existing synthetic account temporarily enabled for pack reveal acceptance","previousEnabled":false}'::jsonb)`;
    });
  const [existing] =
    await db`select p.state,s.handle from beta_public.profiles p join beta_private.social_profiles s on s.user_id=p.id join beta_private.admissions a on a.user_id=p.id where p.id=${qa.id} and a.status='accepted' and p.onboarding_completed_at is not null`;
  assert.ok(
    existing,
    "Existing completed synthetic account required; never onboard a real member",
  );
  const snapshot = async () =>
    JSON.stringify(
      await db`
    select (select jsonb_agg(to_jsonb(p)) from beta_public.profiles p where id=${qa.id}) profile,
    (select jsonb_agg(to_jsonb(a)) from beta_private.admissions a where user_id=${qa.id}) admission,
    (select jsonb_agg(to_jsonb(c) order by c.id) from beta_private.consent_events c where user_id=${qa.id}) consent,
    (select jsonb_agg(to_jsonb(c) order by c.id) from beta_fantasy.cards c where owner_id=${qa.id}) cards`,
    );
  const before = await snapshot();
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  if (!onDomain)
    await context.route("**/*", (r) => {
      const headers = { ...r.request().headers() };
      delete headers["x-vercel-trusted-oidc-idp-token"];
      if (new URL(r.request().url()).origin === base && token)
        headers["x-vercel-trusted-oidc-idp-token"] = token;
      // Staged production intentionally accepts only its final custom origin.
      // Simulate that origin in this private candidate harness; domain run below
      // uses the browser's genuine Origin with no header override or bypass.
      if (
        new URL(r.request().url()).origin === base &&
        r.request().method() === "POST"
      )
        headers.origin = "https://docked.com.au";
      return r.continue({ headers });
    });
  const page = await context.newPage();
  if (privateAccess) {
    assert.equal(new URL(privateAccess.url).origin, base);
    await page.goto(privateAccess.url);
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/app/login");
  await page.getByLabel("Email", { exact: true }).fill(qa.email);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  const login = !onDomain
    ? await context.request.post(base + "/api/auth", {
        headers: { Origin: "https://docked.com.au" },
        data: {
          action: "login",
          email: qa.email,
          password: qa.password,
          app: true,
        },
      })
    : (
        await Promise.all([
          page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/auth" &&
              r.request().method() === "POST",
          ),
          page.getByRole("button", { name: "Log in", exact: true }).click(),
        ])
      )[0];
  const loginResult = await login.json();
  assert.equal(
    login.status(),
    200,
    `QA login: ${loginResult.error ?? "unexpected status"}`,
  );
  console.log(
    JSON.stringify({
      qaLoginStatus: login.status(),
      redirect: loginResult.redirect,
    }),
  );
  if (!onDomain) await page.goto(base + loginResult.redirect);
  console.log(
    JSON.stringify({
      qaPath: new URL(page.url()).pathname,
      qaTitle: await page.title(),
    }),
  );
  await page.waitForURL((u) => u.pathname.startsWith("/fantasy/"), {
    timeout: 30000,
  });
  report.checks.push("Existing ordinary-member password login without MFA");
  await page.goto(base + "/fantasy/cards");
  await page.reload();
  const state = await page.evaluate(async () => {
    const r = await fetch("/api/fantasy");
    return { status: r.status, body: await r.json() };
  });
  assert.equal(state.status, 200);
  assert.equal(state.body.state.user_id, qa.id);
  assert.equal(state.body.state.cards.length, 10);
  report.checks.push(
    "Session restoration and existing ten-card collection intact",
  );
  const receipt = state.body.state.starter_receipt;
  assert.equal(receipt.cards.length, 10);
  assert.equal(new Set(receipt.cards.map((c) => c.id)).size, 10);
  const commands = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/fantasy" && r.method() === "POST")
      commands.push(r.postData());
  });
  for (const width of [412, 1366]) {
    await page.setViewportSize({ width, height: 915 });
    await page
      .getByRole("button", { name: "View saved pack result", exact: true })
      .click();
    await expect(
      page.getByText("REPLAY · NO NEW AWARDS", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: receipt.cards[0].name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reveal next", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: receipt.cards[1].name, exact: true }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    assert.deepEqual(axe.violations, []);
    await page.screenshot({
      path:
        "docs/qa/android-v19/pack-" +
        (onDomain ? "domain" : "candidate") +
        "-" +
        width +
        ".png",
    });
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View saved pack result", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: receipt.cards[1].name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal all", exact: true }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(10);
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "View saved pack result", exact: true })
      .click();
    await expect(page.locator(".pack-summary li")).toHaveCount(10);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("button", {
        name: "Replay saved result · no new cards",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: receipt.cards[0].name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Simple view · all card details are available below."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith("docked:reveal:"))
        .forEach((k) => localStorage.removeItem(k)),
    );
  }
  assert.deepEqual(commands, [], "Replays must send no award commands");
  assert.equal(
    await snapshot(),
    before,
    "Existing account, cards and consent unchanged",
  );
  report.checks.push(
    "Actual saved hosted ten-card receipt, mobile/desktop reveal, resume after refresh, reduced motion, zero dialog accessibility violations, zero award commands, unchanged ownership",
  );
  const sample = await context.request.get(base + "/preview/pack-opening");
  assert.equal(sample.status(), 404);
  assert.deepEqual(errors, []);
  report.passed = true;
} finally {
  await browser?.close();
  if (rosterBefore === false)
    await db.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=false where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','pack_reveal_qa_closed',${qa.id},'{"reason":"Restored original synthetic roster state","resultingEnabled":false}'::jsonb)`;
    });
  await db.end();

  writeFileSync(
    `docs/qa/android-v19/pack-${onDomain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
