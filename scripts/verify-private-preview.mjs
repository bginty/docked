import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const evidence = "docs/qa/private-preview-release/";
const saved = JSON.parse(
  await readFile(evidence + "deployment-status.json", "utf8"),
);
assert.equal(saved.state, "READY");
const live = process.argv[2] === "--live";
assert.ok(live || process.argv[2] === "--candidate");
const origin = live
  ? "https://docked-preview-s24-briant-ginty.vercel.app"
  : saved.url;
assert.match(origin, /^https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app$/);
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token, "Existing same-project short-lived Vercel session required");
const report = {
  passed: false,
  origin,
  deployment: saved.id,
  commit: saved.commit,
  checks: [],
  scope:
    "Hosted read-only screens and denied unauthenticated requests only. No member session, post, purchase or gameplay mutation.",
};
let browser;
async function request(path, options = {}) {
  return fetch(origin + path, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: { "x-vercel-trusted-oidc-idp-token": token, ...options.headers },
  });
}
async function check(name, run) {
  await run();
  report.checks.push(name);
}
try {
  await check("Anonymous Vercel protection", async () => {
    const r = await fetch(origin + "/fantasy/social", { redirect: "manual" });
    assert.ok([401, 403, 302, 307].includes(r.status));
  });
  for (const path of ["/app/login", "/mfa", "/app/reset-password"])
    await check(`Screen ${path}`, async () => {
      const r = await request(path);
      assert.equal(r.status, 200);
      const html = await r.text();
      assert.doesNotMatch(
        html,
        /sb_secret_|postgres(?:ql)?:\/\/|NEXT_NOT_FOUND/,
      );
    });
  await check("Owner setup requires signed-in exact owner", async () => {
    const r = await request("/app/preview-owner");
    const body = await r.text();
    if (r.status === 200) {
      assert.match(
        body,
        /<meta[^>]+http-equiv="refresh"[^>]+content="[01];url=\/app\/login"/,
      );
      assert.doesNotMatch(body, /<h1>Owner MFA verified/);
    } else {
      assert.ok([303, 307].includes(r.status));
      assert.ok(r.headers.get("location")?.includes("/app/login"));
    }
  });
  await check("Private Preview does not claim Production release", async () => {
    assert.equal((await request("/api/beta-release")).status, 404);
  });
  if (live) {
    await check("Invalid invitation rejected without consumption", async () => {
      assert.equal((await request("/auth/invite")).status, 400);
    });
    for (const action of ["signup", "login", "mfa_status"])
      await check(`Unauthorised ${action} denied`, async () => {
        const r = await request("/api/auth", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            email: "nonmember@example.invalid",
            password: "isolated-negative-probe",
          }),
        });
        assert.equal(r.status, 403);
      });
    await check("Foreign origin rejected", async () => {
      const r = await request("/api/auth", {
        method: "POST",
        headers: {
          Origin: "https://foreign.invalid",
          "Content-Type": "application/json",
        },
        body: '{"action":"mfa_status"}',
      });
      assert.equal(r.status, 403);
    });
    await check("Anonymous community API denied", async () => {
      const r = await request("/api/community");
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.status, "sign_in_required");
      assert.equal(body.viewer, null);
      assert.deepEqual(body.posts, []);
      assert.deepEqual(body.profiles, []);
      assert.equal(body.nextCursor, null);
    });
  }
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 412, height: 815 },
  ]) {
    const context = await browser.newContext({ viewport });
    await context.route("**/*", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          ...(new URL(route.request().url()).origin === origin
            ? { "x-vercel-trusted-oidc-idp-token": token }
            : {}),
        },
      }),
    );
    const page = await context.newPage();
    await page.goto(origin + "/app/login", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /log in/i }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: evidence + `owner-login-${viewport.width}.png`,
      fullPage: true,
    });
    await context.close();
    report.checks.push(
      `Login browser ${viewport.width}px, no horizontal overflow`,
    );
  }
  report.passed = true;
} catch (e) {
  report.failure = { name: e.name, code: e.code ?? null };
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(
    evidence + (live ? "hosted.json" : "candidate.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
