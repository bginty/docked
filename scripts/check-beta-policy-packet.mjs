import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Integrity check only: never grants approval, provisions users or changes gates.
const version=process.argv[2] ?? JSON.parse(readFileSync('config/controlled-beta.json','utf8')).policyCandidateVersion;
assert.match(version,/^\d{4}-\d{2}-\d{2}-beta-rc\d+$/);
const root = 'docs/policies/'+version;
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
if(packet.schemaVersion>=2){
 const digest=createHash('sha256').update(packet.documents.map(d=>d.id+':'+d.sha256).sort().join('\n')+'\n').digest('hex');
 assert.equal(packet.packetDigest,digest);
 for(const doc of packet.documents){const content=readFileSync(doc.path,'utf8');assert.match(content,/all aged 18\+/);assert.match(content,/at most ten invited testers/);assert.match(content,/have no monetary value/);assert.match(content,/No unvalidated official betting recommendations/);}
}
assert.equal(packet.approved, false);
console.log(
  JSON.stringify({
    version: packet.version,
    documents: packet.documents.length,
    packetDigest:packet.packetDigest??null,
    integrity: "PASS",
    approval: "PENDING",
    activationAuthorized: false,
  }),
);
