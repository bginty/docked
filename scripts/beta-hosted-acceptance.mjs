// Requires short-lived VERCEL_OIDC_TOKEN from authenticated vercel env run.
// Closed-stage denial/readiness checks only: never creates users or sends mail.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const deployment = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json"),
);
assert.equal(deployment.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(deployment.team, "team_tf6xweKKyVCj9bTppUKttJ4l");
assert.equal(deployment.effectiveTarget, "preview");
const base = deployment.url;
assert.match(
  base,
  /^https:\/\/docked-production-[a-z0-9]+-briant-s-projects\.vercel\.app$/,
);
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token, "Short-lived Vercel authentication required");
const out = "docs/qa/beta-isolation";
mkdirSync(out, { recursive: true });
const assets = new Set();
const report = {
  checkedAt: new Date().toISOString(),
  deploymentId: deployment.id,
  commit: deployment.commit,
  origin: base,
  scope:
    "Actual hosted closed beta connected to dedicated production project through restricted beta role; browser emulation, not physical Android/iPhone. Denial checks are not successful account/gameplay journeys.",
  checks: [],
  pages: [],
  failures: [],
};
async function check(name, run) {
  try {
    const detail = await run();
    report.checks.push({ name, pass: true, ...detail });
  } catch (e) {
    report.checks.push({ name, pass: false });
    report.failures.push({
      name,
      error: String(e).replaceAll(token, "[REDACTED]"),
    });
  }
}
async function req(path, options = {}) {
  return fetch(base + path, {
    ...options,
    redirect: "manual",
    headers: { "x-vercel-trusted-oidc-idp-token": token, ...options.headers },
    signal: AbortSignal.timeout(25000),
  });
}
async function denied(path, method, body, status, origin = base) {
  const r = await req(path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(r.status, status);
  const text = await r.text();
  assert.doesNotMatch(
    text,
    /BEGIN .*PRIVATE KEY|service_role|postgres(?:ql)?:\/\//,
  );
  return { status: r.status };
}
let browser;
try {
  await check("Anonymous access retains Vercel protection", async () => {
    const r = await fetch(base, { redirect: "manual" });
    assert.ok([401, 403, 302, 307].includes(r.status));
    return { status: r.status };
  });
  await check(
    "Hosted status connects to isolated beta database with publication disabled",
    async () => {
      const r = await req("/api/status");
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.equal(data.database, true);
      assert.equal(data.feed, false);
      assert.equal(data.publication, false);
      return { status: r.status, serviceStatus: data };
    },
  );
  await check("Security headers", async () => {
    const r = await req("/");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      r.headers.get("content-security-policy"),
      /connect-src 'self'/,
    );
    assert.match(r.headers.get("strict-transport-security"), /max-age=/);
    return { status: 200 };
  });
  for (const action of [
    "signup",
    "login",
    "recover",
    "resend",
    "reset",
    "mfa_enroll",
  ])
    await check(`Auth ${action} unavailable safely`, () =>
      denied("/api/auth", "POST", { action }, 503),
    );
  await check("Auth rejects foreign origin", () =>
    denied(
      "/api/auth",
      "POST",
      { action: "signup" },
      403,
      "https://example.invalid",
    ),
  );
  await check("Invited setup unavailable", () =>
    denied("/api/auth/invitation-setup", "POST", {}, 503),
  );
  await check("Session API reports not signed in", async () => {
    const r = await req("/api/app-session");
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { authenticated: false });
    return { status: 200 };
  });
  await check("Beta invitation administration remains closed", () =>
    denied("/api/beta/invitations", "POST", {}, 503),
  );
  await check("Robots disallow indexing", async () => {
    const r = await req("/robots.txt");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Disallow: \/(?:\r?\n|$)/);
    return { status: 200 };
  });
  await check("Fantasy read protected", () =>
    denied("/api/fantasy", "GET", null, 403),
  );
  await check("Fantasy write rejects foreign origin", () =>
    denied("/api/fantasy", "POST", {}, 403, "https://example.invalid"),
  );
  await check("Administrator API protected", () =>
    denied("/api/admin", "POST", {}, 403),
  );
  await check(
    "Community read returns only an empty unauthenticated state",
    async () => {
      const r = await req("/api/community");
      assert.equal(r.status, 200);
      const data = await r.json();
      assert.equal(data.status, "sign_in_required");
      assert.deepEqual(data.posts, []);
      assert.deepEqual(data.profiles, []);
      assert.equal(data.viewer, null);
      return { status: 200, serviceStatus: data.status };
    },
  );
  await check("Community writes unavailable", () =>
    denied("/api/community", "POST", {}, 403),
  );
  await check("Android acceptance receipt unavailable", async () => {
    const r = await req("/api/beta-release");
    assert.equal(r.status, 404);
    return { status: 404 };
  });
  for (const query of [
    "code=invalid&next=/app/verified",
    "error=access_denied&error_code=otp_expired&next=/app/verified",
  ])
    await check(
      `Invalid/expired callback ${query.startsWith("code=") ? "code" : "error"} stays on this origin`,
      async () => {
        const r = await req("/auth/callback?" + query);
        assert.equal(r.status, 307);
        assert.equal(r.headers.get("location"), base + "/app/link-expired");
        return { status: r.status };
      },
    );
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 412, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const headers = { ...request.headers() };
      delete headers["x-vercel-trusted-oidc-idp-token"];
      if (new URL(request.url()).origin === base)
        headers["x-vercel-trusted-oidc-idp-token"] = token;
      await route.continue({ headers });
    });
    const page = await context.newPage();
    page.on("response", (r) => {
      if (
        new URL(r.url()).origin === base &&
        /\.(?:js|css)(?:\?|$)/.test(r.url())
      )
        assets.add(r.url());
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of ["/", "/app", "/login", "/app/signup"])
      await check(`Hosted page ${path} at ${width}`, async () => {
        const r = await page.goto(base + path, {
          waitUntil: "networkidle",
          timeout: 45000,
        });
        assert.equal(r.status(), 200);
        assert.match(await page.locator("body").innerText(), /BETA/i);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false);
        if (path === "/app")
          assert.equal(
            await page.locator("button.app-auth-submit").isDisabled(),
            true,
          );
        assert.deepEqual(errors, []);
        report.pages.push({
          path,
          width,
          status: 200,
          overflow,
          uncaughtErrors: errors.length,
        });
        if (path === "/" || path === "/app")
          await page.screenshot({
            path: `${out}/HOSTED-${path === "/" ? "home" : "app"}-${width}.png`,
            fullPage: true,
          });
        return { status: 200 };
      });
    await context.close();
  }
  await check(
    "Repeated homepage and database reads stay available",
    async () => {
      for (let n = 0; n < 5; n++) {
        const home = await req("/");
        assert.equal(home.status, 200);
        const status = await req("/api/status");
        assert.equal((await status.json()).database, true);
      }
      return { rounds: 5 };
    },
  );
  mkdirSync("private-data/production/hosted-beta-assets", { recursive: true });
  for (const [n, url] of [...assets].entries()) {
    const r = await req(new URL(url).pathname);
    assert.equal(r.status, 200);
    writeFileSync(
      "private-data/production/hosted-beta-assets/asset-" + n + ".txt",
      await r.text(),
    );
  }
  report.browserAssetFiles = assets.size;
  await check("Public holding domain remains separate", async () => {
    const r = await fetch("https://docked.com.au", { redirect: "manual" });
    assert.equal(r.status, 200);
    const body = await r.text();
    assert.ok(!body.includes(base));
    const w = await fetch("https://www.docked.com.au", { redirect: "manual" });
    assert.ok([301, 308].includes(w.status));
    assert.equal(new URL(w.headers.get("location")).hostname, "docked.com.au");
    return {
      apexStatus: r.status,
      wwwStatus: w.status,
      location: w.headers.get("location"),
    };
  });
} finally {
  await browser?.close();
  report.passed = report.failures.length === 0;
  writeFileSync(
    out + "/hosted-acceptance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
