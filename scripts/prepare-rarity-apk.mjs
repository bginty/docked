import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const load = (p) => JSON.parse(readFileSync(p));
const d = load("docs/qa/friends-cutover/deployment-status.json");
const domain = load("docs/qa/friends-cutover/domain-boundary.json");
const acceptance = load("docs/qa/rarity-round/domain.json");
assert.equal(acceptance.passed, true);
assert.equal(acceptance.domain, true);
assert.equal(acceptance.deployment, d.id);
assert.equal(acceptance.commit, d.commit);
assert.equal(domain.passed, true);
assert.equal(domain.identity.deploymentId, d.id);
const m = load("config/android-live-beta.json");
m.deploymentId = d.id;
m.commit = d.commit;
m.verifiedAt = new Date().toISOString();
m.evidence.rarityScoring = "docs/qa/rarity-round/domain.json";
m.evidence.rarityReplay = "docs/qa/rarity-round/hosted-replay.json";
m.evidence.physicalDevice =
  "PENDING: physical Samsung S24 and owner visual approval. No emulator claim.";
m.evidence.scoring =
  "Future Week 6 ready; genuine scores pending. Historical rollback replay and corrections verified separately.";
writeFileSync(
  "config/android-live-beta.json",
  JSON.stringify(m, null, 2) + "\n",
);
console.log({ prepared: true, deployment: d.id, origin: m.origin });
