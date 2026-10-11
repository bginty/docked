// Synthetic ordinary-member acceptance only. Never uses the invited friend's email.
// The internal QA reservation counts toward the existing ten-account ceiling;
// it is retained for audit and never silently recycled.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const dir = "private-data/customer-hosted-qa";
mkdirSync(dir, { recursive: true });
const out = "docs/qa/customer-onboarding";
mkdirSync(out, { recursive: true });
const deployment = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json"),
);
assert.equal(deployment.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(deployment.effectiveTarget, "preview");
const base = deployment.url,
  oidc = process.env.VERCEL_OIDC_TOKEN;
assert.ok(oidc, "Run through the exact project Vercel env run");
const file = dir + "/identity.json";
if (!existsSync(file))
  writeFileSync(
    file,
    JSON.stringify({
      id: randomUUID(),
      email: `docked-internal-qa-${randomBytes(5).toString("hex")}@example.invalid`,
      password: randomBytes(24).toString("base64url"),
      token: randomBytes(32).toString("hex"),
    }),
    { mode: 0o600 },
  );
const qa = JSON.parse(readFileSync(file));
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase();
const connection = JSON.parse(
  readFileSync("private-data/production/connection.json"),
);
const auth = createClient(
  `https://${projectRef}.supabase.co`,
  connection.secretKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const report = {
  at: new Date().toISOString(),
  deployment: deployment.id,
  scope:
    "Synthetic ordinary-member hosted browser acceptance; email token generated privately for QA, no email delivery claimed. One internal reservation counts within ten. Not friend or physical-device acceptance.",
  checks: [],
  passed: false,
};
const check = (name) => {
  report.checks.push(name);
  console.log(name);
};
const worker = (enabled) => {
  const path = dir + "/worker.env";
  writeFileSync(
    path,
    `DOCKED_CUSTOMER_SIGNUP_ENABLED=${enabled}\nDOCKED_CUSTOMER_ORIGIN=${base}\n`,
    { mode: 0o600 },
  );
  const r = spawnSync(
    process.execPath,
    [
      "node_modules/supabase/dist/supabase.js",
      "secrets",
      "set",
      "--project-ref",
      projectRef,
      "--env-file",
      path,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 60000 },
  );
  writeFileSync(dir + "/worker.log", r.stdout + "\n" + r.stderr, {
    mode: 0o600,
  });
  assert.equal(r.status, 0, "Worker configuration failed; private log");
};
let browser,
  context,
  activated = false;
try {
  assert.equal(
    (await db`select enabled from beta_private.friends_control`)[0].enabled,
    false,
    "Do not run this closed-stage harness after release",
  );
  assert.equal(
    (await db`select testers_enabled from beta_private.admission_control`)[0]
      .testers_enabled,
    false,
  );
  assert.equal(
    (
      await db`select enabled from private.docked_mail_scheduler where singleton`
    )[0].enabled,
    false,
    "No external email",
  );
  await db.begin(async (tx) => {
    const prior =
      await tx`select intended_user,token_digest from beta_private.customer_invitations where email=${qa.email}`;
    if (prior.length) {
      assert.equal(prior[0].intended_user, qa.id);
      assert.equal(
        prior[0].token_digest,
        createHash("sha256").update(qa.token).digest("hex"),
      );
    } else
      await tx`insert into beta_private.customer_invitations(email,token_digest,intended_user,expires_at,authority) values(${qa.email},${createHash("sha256").update(qa.token).digest("hex")},${qa.id},clock_timestamp()+interval '7 days','Owner-authorised isolated customer journey acceptance; never an external recipient')`;
    await tx`update beta_private.friends_control set enabled=true,readiness_evidence='Protected hosted synthetic customer acceptance only; external release remains closed',approved_by='qa-operator',approved_at=clock_timestamp()`;
    await tx`update beta_private.admission_control set testers_enabled=true where id`;
  });
  activated = true;
  worker(true);
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await context.route("**/*", (route) => {
    const headers = { ...route.request().headers() };
    delete headers["x-vercel-trusted-oidc-idp-token"];
    if (new URL(route.request().url()).origin === base)
      headers["x-vercel-trusted-oidc-idp-token"] = oidc;
    return route.continue({ headers });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const existingUser = (await auth.auth.admin.getUserById(qa.id)).data.user;
  if (existingUser?.email_confirmed_at) {
    await page.goto(base + "/app/login");
    await page.getByLabel("Email", { exact: true }).fill(qa.email);
    await page.getByLabel("Password", { exact: true }).fill(qa.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByLabel("Display name").waitFor({ timeout: 30000 });
    check(
      "Existing verified ordinary QA account resumes setup with original password and no MFA",
    );
  } else {
    await page.goto(base + "/app/signup#invite=" + qa.token);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .waitFor();
    await page.getByLabel("Invited email").fill(qa.email);
    await page.getByLabel("Choose a password").fill(qa.password);
    await page.getByLabel("Confirm password").fill(qa.password);
    await page.screenshot({ path: out + "/hosted-signup.png", fullPage: true });
    const before = (
      await db`select count(*) n from beta_fantasy.cards where owner_id=${qa.id}`
    )[0].n;
    assert.equal(Number(before), 0);
    const response = page.waitForResponse(
      (r) => r.url() === base + "/api/auth/customer-signup",
    );
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    const signup = await response;
    report.signupStatus = signup.status();
    // Dispatch is disabled. Auth creation must remain safely resumable if mail fails.
    const bound = (
      await db`select account_bound_at from beta_private.customer_invitations where intended_user=${qa.id}`
    )[0];
    assert.ok(
      bound.account_bound_at,
      "Worker must bind exact freshly created Auth identity",
    );
    assert.equal(
      Number(
        (
          await db`select count(*) n from beta_public.profiles where id=${qa.id}`
        )[0].n,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await db`select count(*) n from beta_fantasy.cards where owner_id=${qa.id}`
        )[0].n,
      ),
      0,
    );
    check(
      "Invitation and password submission create no consent, starter cards or team",
    );
    const link = await auth.auth.admin.generateLink({
      type: "signup",
      email: qa.email,
      password: qa.password,
    });
    assert.ok(!link.error, "QA token creation failed");
    const token = link.data.properties.hashed_token;
    assert.ok(token);
    await page.goto(
      base + "/auth/verify?type=signup&token_hash=" + encodeURIComponent(token),
    );
    assert.equal(
      (await auth.auth.admin.getUserById(qa.id)).data.user.email_confirmed_at,
      undefined,
    );
    await page.getByRole("button", { name: "Verify my email" }).click();
    await page.getByLabel("Display name").waitFor({ timeout: 30000 });
    check(
      "Actual hosted email-token verification reaches short ordinary-member setup without MFA or internal IDs",
    );
  }
  await page.goto(base + "/app");
  await page.getByLabel("Display name").waitFor();
  assert.equal(await page.getByLabel("Private beta admission code").count(), 0);
  for (const box of await page.getByRole("checkbox").all())
    assert.equal(await box.isChecked(), false);
  await page.getByLabel("Display name").fill("InternalMemberQA");
  await page.getByLabel("State / region").fill("NSW");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  const setup = page.waitForResponse(
    (r) => r.url() === base + "/api/auth/invitation-setup",
  );
  await page.getByRole("button", { name: "Complete account setup" }).click();
  const saved = await setup;
  assert.equal(saved.status(), 200, "Hosted explicit consent persistence");
  await page
    .getByRole("button", { name: "Open my free pack" })
    .waitFor({ timeout: 30000 });
  assert.equal(
    Number(
      (
        await db`select count(*) n from beta_fantasy.cards where owner_id=${qa.id}`
      )[0].n,
    ),
    0,
  );
  await page.reload();
  await page.getByRole("button", { name: "Open my free pack" }).waitFor();
  await page.screenshot({
    path: out + "/hosted-unopened-pack.png",
    fullPage: true,
  });
  check(
    "Explicit AU18+/terms/display-name acceptance persists and unopened entitlement survives refresh",
  );
  await page.getByRole("button", { name: "Open my free pack" }).click();
  await page
    .getByText("Your pack is open.", { exact: false })
    .waitFor({ timeout: 30000 });
  assert.equal(
    Number(
      (
        await db`select count(*) n from beta_fantasy.cards where owner_id=${qa.id}`
      )[0].n,
    ),
    10,
  );
  await page.reload();
  assert.equal(
    Number(
      (
        await db`select count(*) n from beta_fantasy.cards where owner_id=${qa.id}`
      )[0].n,
    ),
    10,
  );
  await page.screenshot({
    path: out + "/hosted-opened-pack.png",
    fullPage: true,
  });
  check("Member explicitly opens ten real NFL beta cards exactly once");
  await context.storageState({ path: dir + "/browser-state.json" });
  assert.deepEqual(errors, []);
  report.passed = true;
} catch (e) {
  report.error = String(e.message)
    .replaceAll(qa.password, "[redacted]")
    .replaceAll(qa.token, "[redacted]")
    .replaceAll(oidc, "[redacted]");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  if (activated) {
    try {
      worker(false);
    } finally {
      await db.begin(async (tx) => {
        await tx`update beta_private.admission_control set testers_enabled=false where id`;
        await tx`update beta_private.friends_control set enabled=false`;
      });
    }
  }
  report.externalAdmissionOpen = false;
  report.emailsSent = 0;
  writeFileSync(
    out + "/hosted-customer-journey.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await db.end();
}
