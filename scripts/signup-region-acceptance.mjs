// Existing synthetic ordinary QA account only. No messages, new admission or awards.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { australianRegions } from "../src/core/australian-region.ts";
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
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','signup_region_qa_started',${qa.id},'{"reason":"Existing synthetic account temporarily enabled for signup regression","previousEnabled":false}'::jsonb)`;
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
  const submit = async (state) => {
    const body = {
      username: existing.handle,
      country: "AU",
      state,
      age: true,
      terms: true,
      privacy: true,
      betaRules: true,
    };
    if (!onDomain) {
      const r = await context.request.post(
        base + "/api/auth/invitation-setup",
        { headers: { Origin: "https://docked.com.au" }, data: body },
      );
      return { status: r.status(), body: await r.json() };
    }
    return page.evaluate(async (body) => {
      const r = await fetch("/api/auth/invitation-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    }, body);
  };
  const invalid = await submit("Unknown region");
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /state or territory/);
  const fullName = australianRegions.find(
    ([code]) => code === existing.state,
  )?.[1];
  assert.ok(fullName);
  const valid = await submit(fullName.toLowerCase());
  assert.equal(valid.status, 200);
  assert.equal(valid.body.redirect, "/fantasy/cards");
  assert.equal(
    await snapshot(),
    before,
    "No change to existing consent, admission, profile or cards",
  );
  report.checks.push(
    "Unknown state gives clear 400; full name accepted through real API; existing account records unchanged",
  );
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
  assert.deepEqual(errors, []);
  report.passed = true;
} finally {
  await browser?.close();
  if (rosterBefore === false)
    await db.begin(async (tx) => {
      await tx`update beta_private.friends_roster set enabled=false where user_id=${qa.id}`;
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','signup_region_qa_closed',${qa.id},'{"reason":"Restored original synthetic roster state","resultingEnabled":false}'::jsonb)`;
    });
  await db.end();
  mkdirSync("docs/qa/signup-region", { recursive: true });
  writeFileSync(
    `docs/qa/signup-region/${onDomain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
