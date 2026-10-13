import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const beforeMode = process.argv.includes("--before"),
  domain = process.argv.includes("--domain") || beforeMode;
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
const base = domain ? "https://docked.com.au" : d.url;
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const sql = ownerDatabase(),
  browser = await chromium.launch({ channel: "msedge" }),
  out = "docs/qa/barry-review";
mkdirSync(out, { recursive: true });
let prior;
const report = {
  at: new Date().toISOString(),
  base,
  commit: d.commit,
  deployment: d.id,
  passed: false,
  checks: [],
  beforeMode,
};
try {
  [prior] =
    await sql`select r.enabled roster,a.enabled wallet from beta_private.friends_roster r join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${qa.id}`;
  await sql`update beta_private.friends_roster set enabled=true where user_id=${qa.id}`;
  await sql`update credits_sandbox.access set enabled=true where user_id=${qa.id}`;
  const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      timezoneId: "Australia/Sydney",
    }),
    page = await context.newPage();
  if (!domain) {
    await page.goto(
      JSON.parse(readFileSync("private-data/signup-candidate-access.json")).url,
    );
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
  const response = await context.request.get(base + "/api/fantasy");
  assert.equal(response.status(), 200);
  const { state } = await response.json();
  const round = state.competitions.find((c) => c.rules.mode === "SALARY_CAP");
  assert.ok(round);
  const rules = await context.request.get(
    base + `/fantasy/scoring/how-it-works?competition=${round.id}`,
  );
  report.rulesStatus = rules.status();
  assert.equal(rules.status(), beforeMode ? 404 : 200);
  for (const tab of ["play", "cards", "results", "market"]) {
    await page.goto(base + `/fantasy/${tab}`);
    await page.getByRole("heading").first().waitFor();
    await page.screenshot({
      path: `${out}/${beforeMode ? "before" : domain ? "domain" : "candidate"}-${tab}.png`,
      fullPage: false,
    });
    if (!beforeMode) {
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (tab === "cards") {
        const opts = await page
          .getByLabel("Position", { exact: true })
          .locator("option")
          .allTextContents();
        assert.ok(opts.includes("QB"));
        assert.ok(!opts.includes("GK"));
        await expect(
          page.getByLabel("Eligible for this competition"),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Card details", exact: true })
          .first()
          .click();
        await page
          .getByRole("link", { name: "Scoring rules", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "NFL scoring rules", exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole("heading", { name: "NFL scoring rules", exact: true }),
        ).toBeVisible();
      }
      if (tab === "play") {
        await page
          .getByRole("link", { name: "Scoring rules", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "NFL scoring rules", exact: true }),
        ).toBeVisible();
      }
      if (tab === "results") {
        await expect(page.getByLabel("Competition mode")).toBeVisible();
        await page.getByLabel("Competition mode").selectOption("OPEN");
        await expect(
          page.getByRole("heading", { name: /NFL Week .*Open/ }),
        ).toBeVisible();
        await page
          .getByRole("link", { name: "Scoring rules", exact: true })
          .first()
          .click();
        await expect(
          page.getByRole("heading", { name: "NFL scoring rules", exact: true }),
        ).toBeVisible();
      }
    }
  }
  if (!beforeMode) {
    await page.goto(base + "/fantasy/test-wallet#packs");
    await expect(page.getByText("100.000%", { exact: true })).toHaveCount(0);
    const wallet = (
      await (await context.request.get(base + "/api/test-wallet")).json()
    ).state;
    assert.ok(
      wallet.products.every(
        (p) =>
          p.version.endsWith("seven-test-v2") && !p.positions.includes("K"),
      ),
    );
    await page.goto(
      base + "/fantasy/scoring/how-it-works?competition=" + round.id,
    );
    const axe = await new AxeBuilder({ page })
      .include(".scoring-review")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((x) => x.id),
      [],
    );
    await page.screenshot({
      path: `${out}/${domain ? "domain" : "candidate"}-rules.png`,
      fullPage: true,
    });
    // Demonstrated read outage, then recovery. Never automatically retry a mutation.
    await context.route("**/api/fantasy/swaps", (route) =>
      route.abort("failed"),
    );
    await page.goto(base + "/fantasy/market");
    await expect(page.getByText(/Collection could not be loaded/)).toBeVisible({
      timeout: 22000,
    });
    await context.unroute("**/api/fantasy/swaps");
    await page
      .getByRole("button", { name: "Refresh ownership and receipts" })
      .click();
    await expect(page.getByText(/Collection could not be loaded/)).toHaveCount(
      0,
    );
    report.checks.push(
      "Ordinary-member Play/Card/Results rules links and direct refresh; sport filters; independent mode results; v2 pack offers; mobile overflow and rules accessibility; controlled network failure and recovery",
    );
  }
  report.passed = true;
} catch (e) {
  report.error = e.message;
  throw e;
} finally {
  await browser.close();
  if (prior) {
    await sql`update beta_private.friends_roster set enabled=${prior.roster} where user_id=${qa.id}`;
    await sql`update credits_sandbox.access set enabled=${prior.wallet} where user_id=${qa.id}`;
    await sql`insert into beta_private.audit_events(actor,action,subject,details)values('qa-operator','barry_review_browser',${qa.id},${sql.json({ beforeMode, passed: report.passed, restored: true })})`;
  }
  await sql.end();
  writeFileSync(
    `${out}/${beforeMode ? "before-browser" : domain ? "domain" : "candidate"}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(report);
}
