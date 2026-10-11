// Local preparation only. Does not push Auth settings, mutate DNS, open admission
// or enable email. Original recovery preimages are never overwritten.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "private-data/friends-cutover";
const read = (p) => readFileSync(p, "utf8");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const preflight = JSON.parse(read("docs/qa/friends-cutover/preflight.json"));
assert.equal(preflight.projectRef, "pojoymtniryarxxunyvz");
assert.equal(preflight.readOnly, true);
assert.ok(
  Date.now() - Date.parse(preflight.at) >= 0 &&
    Date.now() - Date.parse(preflight.at) < 7200000,
  "Fresh read-only preflight required",
);
const auth = preflight.checks.auth;
assert.equal(auth.publicSignup, false);
assert.equal(auth.emailConfirmation, true);
assert.equal(auth.emailHookEnabled, true);
assert.equal(
  auth.emailHookUri,
  "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/docked-auth-email",
);
const redirects = [
  "",
  "?next=/app/verified",
  "?next=/reset-password",
  "?next=/app/reset-password",
].map((s) => "https://docked.com.au/auth/callback" + s);
assert.ok(redirects.every((url) => auth.redirects.includes(url)));
const preimages = [
  "registrar-visible-records-before.json",
  "dns-before.json",
  "auth-before.toml",
].map((file) => ({
  file: root + "/" + file,
  sha256: hash(read(root + "/" + file)),
}));
assert.equal(
  preimages[0].sha256,
  "6cb382616e21f36256d46e107e4cc8ee9e62d36953f6825309ff6d450698432f",
);
const original = read(root + "/supabase/config.toml");
const pattern = /(^\[auth\]\r?\n[\s\S]*?^site_url = )"[^"\r\n]+"/m;
assert.match(original, pattern);
const candidate = original.replace(pattern, '$1"https://docked.com.au"');
assert.notEqual(
  candidate,
  original,
  "Already switched; inspect current cutover rather than preparing over it",
);
assert.equal(
  candidate.replace(
    'site_url = "https://docked.com.au"',
    `site_url = "${auth.siteUrl}"`,
  ),
  original,
  "Only site_url may change",
);
const directory = root + "/auth-candidates/" + hash(candidate).slice(0, 16);
mkdirSync(directory + "/supabase", { recursive: true });
writeFileSync(directory + "/supabase/config.toml", candidate, { mode: 0o600 });
const packet = JSON.parse(read("config/friends-policy-content.json"));
const report = {
  at: new Date().toISOString(),
  applied: false,
  messagesSent: 0,
  projectRef: preflight.projectRef,
  preimages,
  authCandidateDirectory: directory,
  auth: {
    change: "site_url only",
    previous: auth.siteUrl,
    proposed: "https://docked.com.au",
    exactCallbacksAlreadyAllowed: redirects,
    signupRemainsClosed: true,
    signedHookUnchanged: true,
  },
  emailOrigin: {
    proposed: "https://docked.com.au",
    note: "Set DOCKED_BETA_AUTH_ORIGIN at cutover; preserve credentials, Microsoft permissions and approved recipient restriction. Do not enable sending or add recipients here.",
  },
  policy: {
    version: packet.version,
    packetDigest: packet.packetDigest,
    transition:
      "scripts/friends-policy-transition.mjs in one operator transaction before opening gates",
  },
  admission: preflight.checks.admission,
  mailDispatch: preflight.checks.mailDispatch,
  pending: [
    "Due scheduled source evidence",
    "Protected production candidate",
    "Atomic policy/admission activation",
    "Domain and Auth/mail origin switch",
    "Actual domain and authentication acceptance",
    "Accepted-host Android manifest and v17 build",
  ],
};
mkdirSync("docs/qa/friends-cutover", { recursive: true });
writeFileSync(
  "docs/qa/friends-cutover/prepared-cutover.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
