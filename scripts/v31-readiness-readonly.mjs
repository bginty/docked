// Read-only customer entry points and fail-closed release gates. No sign-in,
// signup, purchase, token, wallet or inventory mutation.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const origin = "https://docked.com.au";
const expected = [
  ["/app/login", 200],
  ["/app/signup", 200],
  ["/privacy", 200],
  ["/refund-policy", 200],
  ["/commercial-policy", 200],
  ["/retention", 200],
  ["/account-deletion", 200],
  ["/api/beta-release", 200],
  ["/api/store/google/commercial", 403],
  ["/api/workspace-wallet", 403],
  ["/api/mobile/capabilities", 401],
  ["/api/public-gameplay?sport=nfl", 403],
  ["/api/public-gameplay?sport=afl", 403],
  ["/api/public-gameplay?sport=nrl", 403],
  ["/api/public-gameplay?sport=basketball", 403],
  ["/api/fantasy/scoring-history?sport=basketball", 400],
  ["/profile/qa_billing", 503],
];
const checks = [];
// Bound concurrency to avoid unnecessary load on Production.
for (let i = 0; i < expected.length; i += 3) {
  checks.push(
    ...(await Promise.all(
      expected.slice(i, i + 3).map(async ([route, status]) => {
        const response = await fetch(origin + route, {
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        const body = await response.text();
        assert.equal(response.status, status, route);
        const result = {
          route,
          status,
          cache: response.headers.get("cache-control"),
        };
        if (route === "/api/beta-release") {
          const release = JSON.parse(body);
          assert.equal(release.publicRegistration, false);
          assert.equal(release.invitedAuthentication, true);
          result.registrationClosed = true;
        }
        if (route === "/privacy") {
          assert(
            body.includes("2026-11-06-privacy-sdk-v3"),
            "Current privacy version",
          );
          assert(
            body.includes("Google Play Billing"),
            "Billing privacy disclosure",
          );
          result.privacyVersion = "2026-11-06-privacy-sdk-v3";
        }
        return result;
      }),
    )),
  );
}
const report = {
  at: new Date().toISOString(),
  origin,
  checks,
  passed: true,
  authenticatedAcceptance: false,
  customerMutations: 0,
  purchases: 0,
  publicRegistrationEnabled: false,
  livePaymentsEnabled: false,
};
await writeFile(
  "docs/qa/v31-public-readiness-20261110/live-http.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
