import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const dir = "docs/qa/multi-sport/nba-acceptance/";
const saved = JSON.parse(
  await readFile(dir + "deployment-status.json", "utf8"),
);
assert.equal(saved.projectId, "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR");
assert.equal(saved.state, "READY");
assert.equal(saved.target, "preview");
const origin = saved.url;
assert.match(origin, /^https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app$/);
const env = parseEnv(
  await readFile(
    `private-data/nba-acceptance/${saved.commit}/development-env.private`,
    "utf8",
  ),
);
assert(env.VERCEL_OIDC_TOKEN);
const report = {
  origin,
  commit: saved.commit,
  passed: false,
  checks: [],
  signedInOwnerJourney: false,
  reason: "Preview owner account unconfirmed and MFA not enrolled",
  production: false,
};
const headers = { "x-vercel-trusted-oidc-idp-token": env.VERCEL_OIDC_TOKEN };
let browser;
try {
  const anon = await fetch(origin + "/app/sports-preview?sport=basketball", {
    redirect: "manual",
  });
  assert([401, 403, 302, 307].includes(anon.status));
  report.checks.push({
    name: "Vercel anonymous protection",
    status: anon.status,
  });
  for (const path of [
    "/api/admin/sports-sandbox?sport=basketball",
    "/api/admin/sports-readiness?sport=basketball",
    "/api/admin/scoring-retry",
  ]) {
    const r = await fetch(origin + path, {
      headers,
      redirect: "manual",
      method: path.includes("scoring-retry") ? "POST" : "GET",
    });
    assert([401, 403, 405].includes(r.status));
    report.checks.push({ name: path, status: r.status });
  }
  browser = await chromium.launch();
  for (const width of [412, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 915 },
    });
    await context.route("**/*", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          ...(new URL(route.request().url()).origin === origin ? headers : {}),
        },
      }),
    );
    const page = await context.newPage();
    await page.goto(origin + "/app/login");
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeEnabled();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: dir + `hosted-login-${width}.png`,
      fullPage: true,
    });
    await page.goto(origin + "/app/sports-preview?sport=basketball");
    await expect(
      page.getByRole("heading", { name: /NBA.*Team laboratory/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: dir + `hosted-nba-denial-${width}.png`,
      fullPage: true,
    });
    await page.goto(origin + "/admin/ingestion");
    await page.screenshot({
      path: dir + `hosted-ingestion-denial-${width}.png`,
      fullPage: true,
    });
    const text = await page.locator("body").innerText();
    assert.match(text, /sign in|log in|permission|access|verif/i);
    assert.doesNotMatch(
      await page.content(),
      /sb_secret_|postgres(?:ql)?:\/\//,
    );
    report.checks.push({
      name: "browser",
      width,
      loginHydrated: true,
      overflow: false,
      anonymousNbaAndIngestionDenied: true,
    });
    await context.close();
  }
  report.passed = true;
} catch (e) {
  report.failure = { name: e.name, code: e.code ?? null };
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(dir + "hosted-browser.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
