import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { validateOwnerQaManifest } from "./android-owner-qa-config.mjs";
const d = JSON.parse(
  readFileSync("docs/qa/beta-isolation/deployment-status.json", "utf8"),
);
const b = JSON.parse(
  readFileSync("docs/qa/owner-gameplay/hosted-backend.json", "utf8"),
);
const h = JSON.parse(
  readFileSync("docs/qa/owner-gameplay/hosted-acceptance.json", "utf8"),
);
assert.equal(d.state, "READY");
assert.equal(d.effectiveTarget, "preview");
assert.equal(b.passed, true);
assert.equal(h.passed, true);
assert.equal(h.deployment.id, d.id);
assert.equal(d.aliases.length, 0);
const m = validateOwnerQaManifest({
  schemaVersion: 1,
  kind: "docked-android-owner-qa",
  environment: "protected-preview",
  applicationId: "au.com.docked.app.preview",
  supabaseProjectRef: "pojoymtniryarxxunyvz",
  projectId: d.project,
  teamId: d.team,
  origin: d.url,
  deploymentId: d.id,
  commit: d.commit,
  verifiedAt: new Date().toISOString(),
  ownerOnly: true,
  protected: true,
  externalAdmission: false,
  registration: false,
  payments: false,
  physicalAcceptance: "PENDING",
});
writeFileSync(
  "config/android-owner-qa.json",
  JSON.stringify(m, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    origin: m.origin,
    kind: m.kind,
    physicalAcceptance: "PENDING",
    privilegedCredentialsIncluded: false,
  }),
);
