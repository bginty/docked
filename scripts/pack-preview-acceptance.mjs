// Protected design sample only. No auth reset, member award or external message.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const d = JSON.parse(
  readFileSync("docs/qa/pack-opening/deployment-status.json"),
);
assert.equal(d.effectiveTarget, "preview");
assert.equal(d.state, "READY");
assert.equal(d.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token);
const browser = await chromium.launch();
const report = {
  at: new Date().toISOString(),
  deployment: d.id,
  commit: d.commit,
  scope:
    "Hosted design sample; no genuine member award, physical device or owner visual approval",
  passed: false,
  checks: [],
};
try {
  for (const width of [412, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: 915 },
    });
    await context.route("**/*", (route) => {
      const headers = { ...route.request().headers() };
      delete headers["x-vercel-trusted-oidc-idp-token"];
      if (new URL(route.request().url()).origin === d.url)
        headers["x-vercel-trusted-oidc-idp-token"] = token;
      return route.continue({ headers });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const response = await page.goto(d.url + "/preview/pack-opening");
    assert.equal(response.status(), 200);
    const pageAxe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(pageAxe.violations, []);
    await page.getByRole("button", { name: "Preview starter pack" }).click();
    await page.getByRole("button", { name: "Open pack seal" }).waitFor();
    await page.screenshot({
      path: `docs/qa/pack-opening/hosted-sealed-${width}.png`,
    });
    await page.getByRole("button", { name: "Open pack seal" }).click();
    await page.getByRole("button", { name: "Reveal next" }).waitFor();
    assert.equal(await page.locator(".pack-case").count(), 1);
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    assert.deepEqual(axe.violations, []);
    await page.screenshot({
      path: `docs/qa/pack-opening/hosted-reveal-${width}.png`,
    });
    await page.getByRole("button", { name: "Reveal all", exact: true }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(10);
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("button", { name: "Resume saved result" }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(10);
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.getByRole("button", { name: "Preview single card" }).click();
    await page.getByRole("button", { name: "Open pack seal" }).click();
    await page.getByRole("button", { name: "Collection summary" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Reveal all", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    report.checks.push({
      width,
      starter: true,
      single: true,
      resume: true,
      axeViolations: 0,
      pageErrors: 0,
    });
    const api = await context.request.get(d.url + "/api/fantasy", {
      headers: { "x-vercel-trusted-oidc-idp-token": token },
    });
    assert.ok([401, 403].includes(api.status()));
    await context.close();
  }
  const live = await fetch("https://docked.com.au/api/beta-release");
  assert.equal(live.status, 200);
  const identity = await live.json();
  assert.ok(
    JSON.stringify(identity).includes(
      "fe2bacd40862b680c62ba279489d5b1ac94e998f",
    ),
    "Existing friends deployment must remain unchanged",
  );
  assert.equal(
    (await fetch("https://docked.com.au/preview/pack-opening")).status,
    404,
  );
  report.liveFriendsUnchanged = true;
  report.productionPreviewRouteUnavailable = true;
  report.passed = true;
} finally {
  await browser.close();
  writeFileSync(
    "docs/qa/pack-opening/hosted-browser.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report));
