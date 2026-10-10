import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const d = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json", "utf8"),
);
assert.equal(d.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(d.effectiveTarget, "preview");
const base = d.url,
  token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token);
assert.match(
  base,
  /^https:\/\/docked-production-[a-z0-9]+-briant-s-projects\.vercel\.app$/,
);
const out = process.argv.includes("--fantasy-ux")
  ? "docs/qa/fantasy-ux"
  : process.argv.includes("--owner-gameplay")
    ? "docs/qa/owner-gameplay"
    : "docs/qa/fantasy-cleanup";
const report = {
  at: new Date().toISOString(),
  deployment: d,
  scope:
    "Protected hosted anonymous/application-denial and responsive screens only. No owner impersonation, account creation, email or gameplay transaction.",
  checks: [],
  pages: [],
  failures: [],
};
const request = (path, options = {}) =>
  fetch(base + path, {
    redirect: "manual",
    ...options,
    headers: {
      "x-vercel-trusted-oidc-idp-token": token,
      "x-vercel-skip-toolbar": "1",
      ...options.headers,
    },
    signal: AbortSignal.timeout(25000),
  });
async function check(name, run) {
  try {
    report.checks.push({ name, pass: true, ...(await run()) });
  } catch (e) {
    report.failures.push({
      name,
      error: String(e).replaceAll(token, "[REDACTED]"),
    });
  }
}
await check("Vercel protection remains enabled", async () => {
  const r = await fetch(base, { redirect: "manual" });
  assert.ok([401, 403, 302, 307].includes(r.status));
  return { status: r.status };
});
await check(
  "Sandbox proposal requires owner session; hosted execution always disabled",
  async () => {
    assert.equal((await request("/api/fantasy/market-proposal")).status, 403);
    assert.equal(
      (
        await request("/api/fantasy/market-proposal", {
          method: "POST",
          headers: { Origin: base },
        })
      ).status,
      403,
    );
  },
);
await check("Fantasy identity and closed registration status", async () => {
  const r = await request("/api/status");
  assert.equal(r.status, 200);
  const v = await r.json();
  assert.equal(v.product, "fantasy-cards");
  assert.equal(v.registration, "closed");
  return { status: r.status };
});
for (const path of [
  "/edges",
  "/tips/old",
  "/my-edge",
  "/top-docked",
  "/api/edges",
  "/api/market-data",
  "/api/admin/scanner",
  "/api/admin/research",
])
  await check("Retired " + path, async () => {
    const r = await request(path);
    assert.equal(r.status, 410);
    return { status: r.status };
  });
await check("Fantasy data unavailable to anonymous visitor", async () => {
  const r = await request("/api/fantasy");
  assert.equal(r.status, 403);
  return { status: r.status };
});
await check(
  "Foreign-origin fantasy writes denied before any command",
  async () => {
    const r = await request("/api/fantasy", {
      method: "POST",
      headers: {
        Origin: "https://example.invalid",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(r.status, 403);
    return { status: r.status };
  },
);
await check("Security headers", async () => {
  const r = await request("/");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("content-security-policy"), /connect-src 'self'/);
  return { status: r.status };
});
const browser = await chromium.launch();
try {
  for (const width of [412, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 915 },
    });
    await context.route(base + "/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-trusted-oidc-idp-token": token,
          "x-vercel-skip-toolbar": "1",
        },
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const [name, path] of [
      ["home", "/"],
      ["login", "/app/login"],
      ["signup-closed", "/app/signup"],
      ["cards-gated", "/fantasy/cards"],
      ...(process.argv.includes("--owner-gameplay")
        ? [
            ["play-gated", "/fantasy/play"],
            ["market-gated", "/fantasy/market"],
            ["social-gated", "/fantasy/social"],
            ["profile-gated", "/fantasy/profile"],
          ]
        : []),
    ])
      await check(`Hosted ${name} ${width}`, async () => {
        await page.goto(base + path, { waitUntil: "networkidle" });
        assert.equal(new URL(page.url()).origin, base);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
        );
        const violations = (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations;
        assert.deepEqual(
          violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          [],
        );
        const file = `${out}/hosted-${name}-${width}.png`;
        await page.screenshot({ path: file, fullPage: true });
        report.pages.push({ name, width, path, screenshot: file });
        return { screenshot: file };
      });
    await check(`Hosted console ${width}`, async () => {
      assert.deepEqual(errors, []);
      return { errors: 0 };
    });
    await context.close();
  }
} finally {
  await browser.close();
  report.passed = report.failures.length === 0;
  writeFileSync(
    out + "/hosted-acceptance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      failures: report.failures,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
