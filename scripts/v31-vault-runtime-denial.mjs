// One read-only negative test against the disposable canary, using the existing
// verifier identity. No IAM change, impersonation, live-secret read or key output.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createSign } from "node:crypto";
const e = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/google-rtdn/worker-env.json",
    "utf8",
  ),
);
const identity =
  "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com";
assert.equal(e.DOCKED_GOOGLE_SERVICE_EMAIL, identity);
const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const data =
  enc({ alg: "RS256", typ: "JWT" }) +
  "." +
  enc({
    iss: identity,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 600,
  });
const signature = createSign("RSA-SHA256")
  .update(data)
  .sign(e.DOCKED_GOOGLE_PRIVATE_KEY.replaceAll("\\n", "\n"), "base64url");
e.DOCKED_GOOGLE_PRIVATE_KEY = "";
const auth = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  redirect: "error",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: data + "." + signature,
  }),
  signal: AbortSignal.timeout(30000),
});
assert(auth.ok, "Existing verifier authentication failed; response withheld");
const token = await auth.json();
const response = await fetch(
  "https://secretmanager.googleapis.com/v1/projects/docked-play-verification/secrets/docked-recovery-acceptance/versions/1:access",
  {
    redirect: "error",
    headers: { Authorization: "Bearer " + token.access_token },
    signal: AbortSignal.timeout(30000),
  },
);
token.access_token = "";
const status = response.status;
const body = status === 403 ? await response.json() : null;
if (status !== 403) await response.body?.cancel();
const report = {
  at: new Date().toISOString(),
  project: "docked-play-verification",
  secret: "docked-recovery-acceptance",
  version: 1,
  principal: identity,
  httpStatus: status,
  errorCode: body?.error?.status,
  denied: status === 403 && body?.error?.status === "PERMISSION_DENIED",
  payloadEmitted: false,
  iamChanges: 0,
  liveSecretReads: 0,
  impersonation: false,
};
const out = "docs/qa/v31-prelaunch-execution-20261111/vault-hosted";
mkdirSync(out, { recursive: true });
writeFileSync(
  out + "/runtime-denial.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
assert(report.denied, "Expected verifier denial was not established");
