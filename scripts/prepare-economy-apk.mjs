import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const load = (p) => JSON.parse(readFileSync(p));
const deployment = load("docs/qa/friends-cutover/deployment-status.json");
const domain = load("docs/qa/friends-cutover/domain-boundary.json");
const wallet = load("docs/qa/android-v21/wallet-domain.json");
assert.equal(domain.passed, true);
assert.equal(wallet.passed, true);
assert.equal(wallet.domain, true);
assert.equal(wallet.deployment, deployment.id);
assert.equal(domain.identity.deploymentId, deployment.id);
assert.equal(wallet.commit, deployment.commit);
const manifest = load("config/android-live-beta.json");
manifest.deploymentId = deployment.id;
manifest.commit = deployment.commit;
manifest.verifiedAt = new Date().toISOString();
manifest.evidence.testWallet = "docs/qa/android-v21/wallet-domain.json";
manifest.evidence.cinematicReveal =
  "docs/qa/android-v21/Docked-v21-nine-card-reveal.webm";
manifest.evidence.rarityScoring =
  "Engine/locked-rule fixtures verified; new rarity member-round bridge not activated. Existing equal-scoring free rounds preserved.";
manifest.evidence.physicalDevice =
  "PENDING: owner visual approval and physical Samsung acceptance. No emulator or physical-device claim for v21.";
writeFileSync(
  "config/android-live-beta.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    prepared: true,
    deployment: deployment.id,
    origin: manifest.origin,
  }),
);
