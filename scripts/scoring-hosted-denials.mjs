import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const d = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-submitted.json", "utf8"),
);
assert.equal(d.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(d.effectiveTarget, "preview");
assert.match(
  d.url,
  /^https:\/\/docked-production-[a-z0-9]+-briant-s-projects\.vercel\.app$/,
);
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token, "Existing scoped Vercel authentication required");
const checks = [];
for (const path of ["/fantasy/scoring", "/fantasy/scoring/how-it-works"]) {
  const r = await fetch(d.url + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: {
      "x-vercel-trusted-oidc-idp-token": token,
      "x-vercel-skip-toolbar": "1",
    },
  });
  assert.equal(r.status, 307);
  assert.equal(
    new URL(r.headers.get("location"), d.url).pathname,
    "/app/login",
  );
  checks.push({
    path,
    status: r.status,
    result:
      "Unauthenticated application access denied; Vercel access is not member admission",
  });
}
const external = await fetch(d.url + "/fantasy/scoring", {
  redirect: "manual",
  signal: AbortSignal.timeout(30000),
});
assert.ok([401, 403, 302, 307].includes(external.status));
checks.push({ result: "Vercel protection retained", status: external.status });
const status = await fetch(d.url + "/api/status", {
  headers: { "x-vercel-trusted-oidc-idp-token": token },
  redirect: "error",
  signal: AbortSignal.timeout(30000),
});
assert.equal(status.status, 200);
assert.equal((await status.json()).registration, "closed");
checks.push({ result: "Public signup remains closed" });
const report = {
  at: new Date().toISOString(),
  deployment: d.id,
  commit: d.commit,
  url: d.url,
  checks,
  limitation:
    "No owner session impersonation or real second-user login. Positive scoring UI tested with the persisted local PostgreSQL synthetic read model.",
};
writeFileSync(
  "docs/qa/scoring-v1/hosted.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
