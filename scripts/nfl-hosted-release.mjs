// Fresh protected deployment read/denial acceptance, no session impersonation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-status.json", "utf8"),
);
assert.equal(d.state, "READY");
assert.equal(d.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(d.effectiveTarget, "preview");
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token, "Scoped Vercel access required");
const checks = [];
for (const path of [
  "/fantasy/play",
  "/fantasy/cards",
  "/fantasy/market",
  "/fantasy/social",
  "/fantasy/profile",
  "/fantasy/results",
]) {
  const r = await fetch(d.url + path, {
    headers: { "x-vercel-trusted-oidc-idp-token": token },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(r.status, 307);
  assert.equal(
    new URL(r.headers.get("location"), d.url).pathname,
    "/app/login",
  );
  checks.push({ path, status: r.status });
}
const api = await fetch(d.url + "/api/fantasy", {
  headers: { "x-vercel-trusted-oidc-idp-token": token },
  signal: AbortSignal.timeout(20000),
});
assert.ok([401, 403].includes(api.status));
checks.push({ path: "/api/fantasy", status: api.status });
const status = await fetch(d.url + "/api/status", {
  headers: { "x-vercel-trusted-oidc-idp-token": token },
  signal: AbortSignal.timeout(20000),
});
assert.equal(status.status, 200);
assert.equal((await status.json()).registration, "closed");
const external = await fetch(d.url + "/fantasy/play", {
  redirect: "manual",
  signal: AbortSignal.timeout(20000),
});
assert.ok([401, 403, 302, 307].includes(external.status));
const report = {
  at: new Date().toISOString(),
  passed: true,
  commit: d.commit,
  deployment: { id: d.id, url: d.url },
  checks,
  protection: external.status,
  registration: "closed",
  limitation:
    "Hosted HTTP denial checks; positive gameplay is hosted SQL acceptance plus separate local browser interaction, not two authenticated browser sessions",
};
writeFileSync(
  "docs/qa/nfl-member/hosted-release.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
