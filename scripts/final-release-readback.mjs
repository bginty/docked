/** Read-only release/route evidence. No cookies, tokens or response bodies saved. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const preview = "https://docked-preview-s24-briant-ginty.vercel.app";
const env = await fs.readFile(
  "private-data/restored-public-preview/oidc.private.env",
  "utf8",
);
const token = env.match(/^VERCEL_OIDC_TOKEN="?([^"\r\n]+)"?$/m)?.[1];
assert(token);
const report = { at: new Date().toISOString(), mutations: 0, checks: [] };
for (const url of [
  preview + "/app/login",
  "https://docked.com.au/api/beta-release",
  ...[
    "privacy",
    "refund-policy",
    "retention",
    "commercial-policy",
    "account-deletion",
  ].map((p) => "https://docked.com.au/" + p),
]) {
  const r = await fetch(url, {
    redirect: "error",
    headers:
      new URL(url).origin === preview
        ? { "x-vercel-trusted-oidc-idp-token": token }
        : {},
  });
  assert.equal(r.status, 200, url);
  const text = await r.text();
  const check = {
    url,
    status: r.status,
    sha256: createHash("sha256").update(text).digest("hex"),
  };
  if (url.endsWith("/api/beta-release")) {
    const data = JSON.parse(text);
    assert.equal(data.publicRegistration, false);
    assert.equal(data.origin, "https://docked.com.au");
    check.identity = data;
  } else if (new URL(url).origin === preview) {
    assert.match(text, /Welcome back/);
    check.loginRendered = true;
  }
  report.checks.push(check);
}
await fs.writeFile(
  "docs/qa/final-australia-20261102/hosted-readback.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    passed: true,
    readOnlyRoutes: report.checks.length,
    mutations: 0,
  }),
);
