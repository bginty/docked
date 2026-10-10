import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const d = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json", "utf8"),
);
assert.equal(d.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(d.effectiveTarget, "preview");
const origin = d.url,
  token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token);
const checks = [];
const req = (path, options = {}) =>
  fetch(origin + path, {
    ...options,
    headers: {
      "x-vercel-trusted-oidc-idp-token": token,
      Origin: origin,
      "Content-Type": "application/json",
      ...options.headers,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(25000),
  });
assert.ok(
  [401, 403, 302, 307].includes(
    (await fetch(origin, { redirect: "manual" })).status,
  ),
);
checks.push("Hosting protection remains enabled");
const status = await req("/api/status");
assert.equal((await status.json()).registration, "closed");
checks.push("Public registration closed");
const swaps = await req("/api/fantasy/swaps");
assert.equal(swaps.status, 400);
assert.equal((await swaps.json()).error, "Two-person sandbox unavailable");
checks.push("Sandbox execution remains unavailable before activation");
assert.equal(
  (
    await req("/api/fantasy/swaps", {
      method: "POST",
      headers: { Origin: "https://example.invalid" },
      body: "{}",
    })
  ).status,
  403,
);
checks.push("Foreign-origin swap denied");
const browser = await chromium.launch();
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: 915 },
    });
    await context.route(origin + "/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-trusted-oidc-idp-token": token,
          "x-vercel-skip-toolbar": "1",
        },
      }),
    );
    const page = await context.newPage();
    await page.goto(origin + "/mfa");
    await page.getByText("Sign in first", { exact: true }).waitFor();
    assert.equal(await page.locator('input[name="factorId"]').count(), 0);
    assert.equal(await page.locator(".mfa-qr").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `docs/qa/two-person-beta/hosted-mfa-${width}.png`,
      fullPage: true,
    });
    await context.close();
    checks.push(
      `Hosted MFA ${width}px: no internal factor field, no enrollment secret for anonymous visitor`,
    );
  }
} finally {
  await browser.close();
}
const report = {
  at: new Date().toISOString(),
  deployment: d,
  scope:
    "Actual hosted anonymous denial and browser-emulated layout; not owner login, tester acceptance or physical device",
  passed: true,
  checks,
};
writeFileSync(
  "docs/qa/two-person-beta/hosted-web.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ passed: true, checks }));
