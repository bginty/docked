/** Real hosted routes, synthetic identities only. Does not operate Play Console. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import postgres from "postgres";
const dir = "private-data/restored-public-preview",
  out = "docs/qa/launch-resolution-20261102";
const f = JSON.parse(await fs.readFile(`${dir}/fixture.private.json`, "utf8"));
assert.equal(f.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(f.origin, "https://docked-preview-s24-briant-ginty.vercel.app");
const config = JSON.parse(
  await fs.readFile(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(config.projectRef, f.projectRef);
const sql = postgres(config.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: await fs.readFile("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const variables = await fs.readFile(`${dir}/oidc.private.env`, "utf8");
const oidc = variables.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(oidc, "Refresh project OIDC credential privately");
const kind = process.argv[3] ?? "member",
  a = f.accounts.find((v) => v.kind === kind);
assert(a);
const mode = process.argv[2];
assert(["signup", "play", "screens", "deletion"].includes(mode));
const report = {
  at: new Date().toISOString(),
  origin: f.origin,
  kind,
  mode,
  synthetic: true,
  externalEmail: false,
  productionWrites: 0,
  checks: [],
  passed: false,
};
const check = (x) => {
  report.checks.push(x);
  console.log(x);
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
let state;
try {
  state = JSON.parse(
    await fs.readFile(`${dir}/${kind}-session.private.json`, "utf8"),
  );
} catch {}
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ...(state ? { storageState: state } : {}),
});
await context.route("**/*", (route) => {
  const headers = { ...route.request().headers() };
  delete headers["x-vercel-trusted-oidc-idp-token"];
  if (new URL(route.request().url()).origin === f.origin)
    headers["x-vercel-trusted-oidc-idp-token"] = oidc;
  return route.continue({ headers });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const snapshot = async (name) =>
  page.screenshot({ path: `${out}/${kind}-${name}-390.png`, fullPage: true });
const api = async (path) =>
  page.evaluate(async (p) => {
    const r = await fetch(p, { cache: "no-store" });
    return { status: r.status, body: await r.json() };
  }, path);
try {
  if (mode === "signup") {
    const existing = (
      await sql`select id,email_confirmed_at from auth.users where email=${a.email}`
    )[0];
    if (!existing) {
      await page.goto(f.origin + "/app/signup");
      await page
        .locator("form[data-api-ready=true]")
        .waitFor({ timeout: 45000 });
      await page
        .getByLabel("Username", { exact: true })
        .fill("Qa" + a.email.split("-").at(-1).split("@")[0]);
      await page.getByLabel("Email", { exact: true }).fill(a.email);
      await page.getByLabel("Password", { exact: true }).fill(a.password);
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill(a.password);
      await page.locator("select[name=state]").selectOption("NSW");
      for (const name of ["age", "terms", "privacy"])
        await page.locator(`[name=${name}]`).check();
      const response = page.waitForResponse(
        (r) =>
          r.url() === f.origin + "/api/auth" && r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      const r = await response;
      assert.equal(r.status(), 200, JSON.stringify(await r.json()));
      check(
        "Normal hosted signup accepted with explicit age, Terms and Privacy consent",
      );
    }
    let who = (
      await sql`select id,email_confirmed_at from auth.users where email=${a.email}`
    )[0];
    assert(who);
    if (!who.email_confirmed_at) {
      const [mail] =
        await sql`select token_hash,redirect_to from preview_auth.hosted_mail where auth_user_id=${who.id} and action='signup' and expires_at>clock_timestamp() order by received_at desc limit 1`;
      assert(mail, "Actual confirmation email hook must have captured a token");
      const target = new URL(
        `https://${f.projectRef}.supabase.co/auth/v1/verify`,
      );
      target.searchParams.set("token", mail.token_hash);
      target.searchParams.set("type", "signup");
      target.searchParams.set("redirect_to", mail.redirect_to);
      // Resolve the Auth redirect without forwarding the Vercel credential to
      // Supabase. Start a fresh origin-scoped navigation for the PKCE callback.
      const verified = await fetch(target.href, { redirect: "manual" });
      const callback = verified.headers.get("location");
      assert(callback && new URL(callback).origin === f.origin);
      await page.goto(callback);
      await page.waitForURL((u) => u.origin === f.origin, { timeout: 45000 });
      who = (
        await sql`select id,email_confirmed_at from auth.users where id=${who.id}`
      )[0];
      assert(who.email_confirmed_at);
      check(
        "Actual Auth-generated email confirmation token verified; no admin autoconfirm",
      );
    }
    if (who.email_confirmed_at)
      check(
        "Hosted identity has confirmed email and its own provisioned profile",
      );
    await page.goto(f.origin + "/app/login");
    if (await page.getByLabel("Email", { exact: true }).count()) {
      await page.locator("form[data-api-ready=true]").waitFor();
      await page.getByLabel("Email", { exact: true }).fill(a.email);
      await page.getByLabel("Password", { exact: true }).fill(a.password);
      const response = page.waitForResponse(
        (r) =>
          r.url() === f.origin + "/api/auth" && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      assert.equal((await response).status(), 200);
      await page.waitForURL(
        (u) => u.origin === f.origin && u.pathname !== "/app/login",
      );
      check("Normal authenticated sign-in succeeds");
    }
    await page.goto(f.origin + "/app/onboarding");
    for (let i = 0; i < 4; i++) {
      if (
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .count()
      ) {
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
      } else if (
        await page
          .getByRole("button", { name: "Enter Docked", exact: true })
          .count()
      ) {
        const response = page.waitForResponse(
          (r) =>
            r.url() === f.origin + "/api/member" &&
            r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Enter Docked", exact: true })
          .click();
        assert.equal((await response).status(), 200);
        await page.waitForURL((u) => u.pathname === "/fantasy/play");
        break;
      } else break;
    }
    await page.goto(f.origin + "/fantasy/play?sport=nfl");
    await page
      .getByRole("heading", { name: "Your lineup" })
      .waitFor({ timeout: 45000 });
    const result = await api("/api/public-gameplay");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.allowed, ["nfl", "afl", "nrl"]);
    check(
      "Ordinary customer capabilities include NFL/AFL/NRL without private-beta admission",
    );
    assert.equal(
      (await api("/api/public-gameplay?sport=basketball")).status,
      403,
    );
    check("NBA unavailable server-side");
    await context.storageState({ path: `${dir}/${kind}-session.private.json` });
    await snapshot("signed-in");
  }
  if (mode === "play") {
    for (const sport of ["nfl", "afl", "nrl"]) {
      await page.goto(f.origin + `/fantasy/play?sport=${sport}`);
      await page
        .getByRole("button", { name: "Auto Select", exact: true })
        .waitFor({ timeout: 45000 });
      if (
        await page
          .getByRole("button", { name: "Choose team name", exact: true })
          .count()
      ) {
        await page
          .getByRole("button", { name: "Choose team name", exact: true })
          .click();
        await page
          .getByLabel("Team name", { exact: true })
          .fill("Isolated acceptance");
        await page
          .getByRole("button", { name: "Save name", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Save name", exact: true })
          .waitFor({ state: "hidden" });
      }
      await page
        .getByRole("button", { name: "Auto Select", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Apply lineup", exact: true })
        .click();
      let response = page.waitForResponse(
        (r) =>
          r.url().includes("/api/public-gameplay") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      assert.equal((await response).status(), 200);
      await page.getByText("Draft saved", { exact: true }).waitFor();
      response = page.waitForResponse(
        (r) =>
          r.url().includes("/api/public-gameplay") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Enter Team", exact: true })
        .click();
      assert.equal((await response).status(), 200);
      await page.getByText("Team entry confirmed", { exact: true }).waitFor();
      const result = await api(`/api/public-gameplay?sport=${sport}`);
      assert.equal(result.status, 200);
      assert.equal(result.body.state.entries.length, 1);
      assert.equal(
        result.body.state.entries[0].snapshot.length,
        { nfl: 7, afl: 22, nrl: 13 }[sport],
      );
      await snapshot(`${sport}-entered`);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: `${out}/${sport}-entered-1440.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(f.origin + `/fantasy/results?sport=${sport}`);
      await page
        .getByRole("heading", { name: "Rankings", exact: true })
        .waitFor({ timeout: 45000 });
      await snapshot(`${sport}-rankings`);
      check(
        `${sport.toUpperCase()}: free-Core auto-selection, draft, confirmed entry and rendered Rankings`,
      );
    }
    const [who] = await sql`select id from auth.users where email=${a.email}`;
    const [summary] =
      await sql`select (select count(*)::int from commercial_billing.cards where owner_id=${who.id}) cards,(select count(*)::int from commercial_billing.receipts where member_id=${who.id}) receipts,(select coalesce(sum(remaining),0)::int from commercial_billing.lots where member_id=${who.id}) credits,(select count(*)::int from beta_fantasy.entries where user_id=${who.id}) entries`;
    assert.deepEqual(summary, {
      cards: 0,
      receipts: 0,
      credits: 0,
      entries: 3,
    });
    report.summary = summary;
    check(
      "All three entries use eligibility only: zero collectibles, paid receipts or credited funds",
    );
  }
  if (mode === "screens") {
    for (const route of [
      "/fantasy/cards?sport=afl",
      "/fantasy/packs?sport=nrl",
      "/fantasy/market?sport=nfl",
      "/profile",
      "/terms",
      "/privacy",
      "/refund-policy",
      "/retention",
      "/account-deletion",
    ]) {
      const r = await page.goto(f.origin + route);
      assert.equal(r.status(), 200);
      await page.waitForLoadState("networkidle");
      assert(
        !/Docked couldn.t load/.test(await page.locator("body").innerText()),
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await snapshot(route.split("?")[0].replaceAll("/", "-"));
      check("Rendered " + route);
    }
  }
  if (mode === "deletion") {
    await page.goto(f.origin + "/dashboard");
    await page
      .getByRole("button", { name: "Delete my account", exact: true })
      .waitFor({ timeout: 45000 });
    await snapshot("deletion-before");
    await page
      .getByLabel("Type DELETE to confirm", { exact: true })
      .fill("DELETE");
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Delete my account", exact: true })
      .click();
    const r = await response;
    report.requestStatus = r.status();
    assert(r.ok());
    const [who] = await sql`select id from auth.users where email=${a.email}`;
    assert(who);
    const [profile] =
      await sql`select disabled_at from public.profiles where id=${who.id}`;
    assert(profile?.disabled_at);
    check(
      "Actual customer-facing deletion request revoked the isolated account; erasure queued for scoped worker",
    );
    await snapshot("deletion-requested");
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  report.passed = true;
} catch (e) {
  report.error = String(e.message)
    .replaceAll(a.email, "[synthetic-email]")
    .replaceAll(a.password, "[redacted]")
    .replace(/token=[^&\s]+/g, "token=[redacted]")
    .replace(/https:\/\/[^\s"]+/g, "[URL omitted]")
    .slice(0, 1200);
  await snapshot("failure").catch(() => {});
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    `${out}/${kind}-${mode}.json`,
    JSON.stringify(report, null, 2),
  );
  await context
    .storageState({ path: `${dir}/${kind}-session.private.json` })
    .catch(() => {});
  await browser.close();
  await sql.end();
}
