import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Integrity check only: never grants approval, provisions users or changes gates.
const version =
  process.argv[2] ??
  JSON.parse(readFileSync("config/controlled-beta.json", "utf8"))
    .policyCandidateVersion;
assert.match(version, /^\d{4}-\d{2}-\d{2}-beta-rc\d+$/);
const root = "docs/policies/" + version;
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
if (packet.schemaVersion >= 2) {
  const digest = createHash("sha256")
    .update(
      packet.documents
        .map((d) => d.id + ":" + d.sha256)
        .sort()
        .join("\n") + "\n",
    )
    .digest("hex");
  assert.equal(packet.packetDigest, digest);
  for (const doc of packet.documents) {
    const content = readFileSync(doc.path, "utf8");
    assert.match(content, /all aged 18\+/);
    assert.match(content, /at most ten invited testers/);
    assert.match(content, /have no monetary value/);
    assert.match(content, /No unvalidated official betting recommendations/);
  }
}
assert.equal(packet.approved, false);
// Preserve the exact reviewed draft bytes; subsequent owner approval is a
// separate receipt, never an edit to the content the owner approved.
const receiptPath = `${root}/owner-approval.json`;
let approval = "PENDING";
if (existsSync(receiptPath)) {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(receipt.version, packet.version);
  assert.equal(receipt.digest, packet.packetDigest);
  assert.equal(
    receipt.status,
    "owner-approved-subject-to-unresolved-requirements",
  );
  assert.equal(receipt.approvedBy, "Owner");
  assert.ok(Number.isFinite(Date.parse(receipt.approvedAt)));
  assert.match(receipt.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(
    receipt.documents,
    packet.documents.map(({ id, title, version, path, sha256 }) => ({
      id,
      title,
      version,
      path,
      sha256,
    })),
  );
  assert.equal(receipt.scope.ownerOnlyAcceptanceAuthorized, true);
  assert.equal(receipt.scope.externalAdmissionAuthorized, false);
  assert.equal(receipt.scope.publicRegistrationAuthorized, false);
  assert.equal(receipt.scope.productionPromotionAuthorized, false);
  for (const file of ["config/controlled-beta.json", "config/hosted-beta.json"])
    assert.deepEqual(
      JSON.parse(readFileSync(file, "utf8")).policyApproval,
      receipt,
    );
  const content = JSON.parse(
    readFileSync("config/beta-policy-content.json", "utf8"),
  );
  assert.equal(content.version, packet.version);
  assert.equal(content.packetDigest, packet.packetDigest);
  assert.deepEqual(
    content.documents.map((d) => d.id),
    packet.documents.map((d) => d.id),
  );
  for (const doc of content.documents) {
    assert.equal(doc.text, readFileSync(`${root}/${doc.id}.md`, "utf8"));
    assert.equal(
      createHash("sha256").update(doc.text).digest("hex"),
      doc.sha256,
    );
  }
  approval = "OWNER_APPROVED_CONDITIONAL";
}
console.log(
  JSON.stringify({
    version: packet.version,
    documents: packet.documents.length,
    packetDigest: packet.packetDigest ?? null,
    integrity: "PASS",
    approval,
    activationAuthorized: false,
  }),
);
