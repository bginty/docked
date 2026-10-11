// Public-domain boundary checks only. No credentials, invitations, messages,
// account creation, password changes or successful token consumption.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const base = "https://docked.com.au";
const report = {
  at: new Date().toISOString(),
  origin: base,
  scope:
    "Anonymous domain/callback boundary acceptance; NOT authenticated gameplay or email delivery",
  checks: [],
  passed: false,
};
async function check(name, fn) {
  try {
    report.checks.push({ name, passed: true, ...(await fn()) });
  } catch (e) {
    report.checks.push({
      name,
      passed: false,
      reason: String(e.message).slice(0, 240),
    });
  }
}
const req = (path, options = {}) =>
  fetch(base + path, {
    ...options,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
await check(
  "Domain serves the exact staged friends deployment without hosting credentials",
  async () => {
    const expected = JSON.parse(
      readFileSync("docs/qa/friends-cutover/deployment-status.json", "utf8"),
    );
    assert.equal(expected.state, "READY");
    assert.equal(expected.effectiveTarget, "production");
    const r = await req("/api/beta-release");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
    const identity = await r.json();
    assert.equal(identity.origin, base);
    assert.equal(identity.hostingProvider, "vercel");
    assert.equal(identity.siteId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
    assert.equal(identity.hostingAccountId, "team_tf6xweKKyVCj9bTppUKttJ4l");
    assert.equal(identity.projectRef, "pojoymtniryarxxunyvz");
    assert.equal(identity.commit, expected.commit);
    assert.equal(identity.deploymentId, expected.id);
    assert.equal(identity.publicRegistration, false);
    assert.equal(identity.invitedAuthentication, true);
    report.identity = identity;
    return {
      status: r.status,
      deploymentId: expected.id,
      commit: expected.commit,
    };
  },
);
// Never run app-specific tests against the holding page or an unexpected release.
if (report.identity) {
  await check(
    "www redirects directly to the accepted HTTPS domain",
    async () => {
      const r = await fetch("https://www.docked.com.au/app", {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
      assert.ok([301, 308].includes(r.status));
      assert.equal(new URL(r.headers.get("location")).href, base + "/app");
      return { status: r.status };
    },
  );
  await check("HTTP redirects to HTTPS", async () => {
    const r = await fetch("http://docked.com.au/app", {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    assert.ok([301, 308].includes(r.status));
    assert.equal(new URL(r.headers.get("location")).href, base + "/app");
    return { status: r.status };
  });
  await check(
    "No-code callback cannot redirect to a foreign site",
    async () => {
      const r = await req("/auth/callback?next=https%3A%2F%2Fattacker.invalid");
      assert.equal(r.status, 307);
      assert.equal(
        new URL(r.headers.get("location")).href,
        base + "/login?error=verification",
      );
      return { status: r.status };
    },
  );
  await check(
    "No-code app callback has a recoverable expired-link destination",
    async () => {
      const r = await req("/auth/callback?next=/app/reset-password");
      assert.equal(r.status, 307);
      assert.equal(
        new URL(r.headers.get("location")).href,
        base + "/app/link-expired",
      );
      return { status: r.status };
    },
  );
  for (const action of ["invite", "recovery"]) {
    const token = "docked_boundary_not_a_real_token_" + "x".repeat(32);
    const path = `/auth/${action}?type=${action}&token_hash=${token}`;
    await check(
      `${action} GET is non-consuming, uncached and same-origin`,
      async () => {
        for (let i = 0; i < 2; i++) {
          const r = await req(path);
          assert.equal(r.status, 200);
          assert.match(r.headers.get("cache-control") ?? "", /no-store/);
          assert.equal(r.headers.get("location"), null);
          assert.match(await r.text(), /method="post"/);
        }
        return { repeatedGet: true, syntheticNonCredential: true };
      },
    );
    await check(`${action} rejects a foreign-origin POST`, async () => {
      const r = await req(`/auth/${action}`, {
        method: "POST",
        headers: {
          Origin: "https://attacker.invalid",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ type: action, token_hash: token }),
      });
      assert.equal(r.status, 403);
      assert.equal(r.headers.get("location"), null);
      return { status: r.status };
    });
  }
  for (const path of ["/api/fantasy", "/api/admin/operations"]) {
    await check(`Anonymous private data denied: ${path}`, async () => {
      const r = await req(path);
      assert.ok([401, 403].includes(r.status));
      return { status: r.status };
    });
  }
  await check(
    "Auth API rejects a foreign origin without any provider request",
    async () => {
      const r = await req("/api/auth", {
        method: "POST",
        headers: {
          Origin: "https://attacker.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "recover" }),
      });
      assert.equal(r.status, 403);
      return { status: r.status };
    },
  );
  await check("Current privacy packet and no public signup", async () => {
    const packet = JSON.parse(
      readFileSync("config/friends-policy-content.json", "utf8"),
    );
    const page = await req("/beta-policies");
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(packet.version));
    const status = await req("/api/status");
    assert.equal((await status.json()).registration, "closed");
    return { version: packet.version };
  });
}
report.passed = !!report.identity && report.checks.every((c) => c.passed);
mkdirSync("docs/qa/friends-cutover", { recursive: true });
writeFileSync(
  "docs/qa/friends-cutover/domain-boundary.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
process.exitCode = report.passed ? 0 : 1;
