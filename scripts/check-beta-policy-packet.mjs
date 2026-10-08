import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Integrity check only: never grants approval, provisions users or changes gates.
const root = "docs/policies/2026-10-09-beta-rc1";
const packet = JSON.parse(readFileSync(`${root}/manifest.json`, "utf8"));
const expected = [
  "privacy",
  "terms",
  "beta-participation",
  "community",
  "fantasy-cards",
  "competition-points",
  "responsible-gambling",
];
assert.deepEqual(packet.documents.map((d) => d.id).sort(), expected.sort());
for (const doc of packet.documents) {
  assert.equal(doc.path, `${root}/${doc.id}.md`);
  assert.equal(doc.version, packet.version);
  const bytes = readFileSync(doc.path);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    doc.sha256,
    `${doc.id}: content changed; prepare a new reviewed candidate`,
  );
  assert.equal(doc.approved, false);
  assert.equal(doc.status, "draft");
}
assert.equal(packet.approved, false);
console.log(
  JSON.stringify({
    version: packet.version,
    documents: packet.documents.length,
    integrity: "PASS",
    approval: "PENDING",
    activationAuthorized: false,
  }),
);
