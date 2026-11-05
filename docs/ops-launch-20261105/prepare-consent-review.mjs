/** Read-only review package; does not modify application, deployment, database,
 * approved policy wording or anyone's consent. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");
const policyPath = "config/launch-policy-content.json";
const bytes = await readFile(path.join(root, policyPath));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
// Git's approved UTF-8 source uses LF; this Windows checkout uses CRLF. Do not
// rewrite the approved file or confuse checkout newline translation with drift.
const fileHash = sha256(bytes.toString("utf8").replaceAll("\r\n", "\n"));
assert.equal(
  fileHash,
  "9655ebb36bd5410ff07e18001d26c999ab51d4f85345252aab9ca9b293e89b93",
);
const packet = JSON.parse(bytes);
assert.equal(packet.version, "2026-11-02-release-preparation-v2");
const getDoc = (id) => {
  const document = packet.documents.find((doc) => doc.id === id);
  assert(document);
  return {
    id,
    title: document.title,
    url: `https://docked.com.au/${id}`,
    sha256CanonicalDocument: sha256(JSON.stringify(document)),
  };
};
const manifest = {
  preparedAt: new Date().toISOString(),
  status: "OWNER_ADOPTION_DECISION_REQUIRED_NOT_APPLIED",
  purpose:
    "Prospective public signup Terms/Privacy document binding; no reapproval of commercial model or v2 wording requested",
  operator: {
    legalName: "Ginty United Investments Pty Ltd",
    abn: "78606187106",
    identityEvidence: "official-entity-readback.json",
    legalClearanceImplied: false,
  },
  existingApprovedPublication: {
    source: policyPath,
    version: packet.version,
    sha256: fileHash,
    checksumEncoding: "UTF-8 source with Git LF line endings",
    workingCopySha256: sha256(bytes),
    published: true,
    wordingChanged: false,
  },
  proposedProspectiveBinding: {
    TERMS_VERSION: packet.version,
    PRIVACY_POLICY_VERSION: packet.version,
    LEGAL_ENTITY_VERIFIED: "true",
    DOCKED_LEGAL_NAME: "Ginty United Investments Pty Ltd",
    DOCKED_ABN: "78606187106",
    DOCKED_SUPPORT_EMAIL: "support@docked.com.au",
    terms: {
      ...getDoc("commercial-policy"),
      entryUrl: "https://docked.com.au/terms",
      decision:
        "Adopt this already-published document as the Terms linked by future public signup; source already has the redirect under public-customer mode",
    },
    privacy: getDoc("privacy"),
    relatedDocuments: [getDoc("refund-policy"), getDoc("retention")],
    documentHashFormat:
      "SHA-256 of UTF-8 JSON.stringify of the unmodified document object in the pinned source packet",
  },
  databaseBinding: {
    relation: "public_gameplay.policy",
    enabled: false,
    terms_version: packet.version,
    privacy_version: packet.version,
    authority: null,
    valid_until: null,
    note: "Authority/expiry require a reviewed release record; this preparation writes no database value",
  },
  preservedDisabledControls: {
    publicRegistration: false,
    realPayments: false,
    withdrawals: false,
    paidCompetitionEntry: false,
    prizes: false,
    commercialTransfers: false,
    nbaVisible: false,
    irreversibleCleanup: false,
  },
  consentHandling: {
    newSignup: "Separate unticked age, Terms and Privacy confirmations",
    oldConsents:
      "Preserve events and snapshots. Require new affirmative consent if a public account's applicable version differs; never rewrite historical acceptance.",
    staffMfa: "Unchanged",
  },
  exactOwnerDecision:
    "Adopt the already approved and published Service and commercial release policy v2 as the Terms for future public-account registration, with Privacy v2 as its separate Privacy notice, using the pinned IDs/hashes in this manifest. This adoption enables no registration, payment, competition, transfer or cleanup switch.",
  materialBeforePublicActivation: [
    "The exact v2 wording still describes an invitation-only beta, closed public registration and disabled purchases. Before any state changes, publish a separately versioned current-service availability notice matching the actually enabled flags, with owner approval of those text changes.",
    "Do not describe publication approval as prospective contractual adoption, independent legal review or regulatory clearance.",
  ],
  changesApplied: 0,
};
await writeFile(
  path.join(dir, "PUBLIC_CONSENT_ADOPTION_REVIEW.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    prepared: true,
    sha256: fileHash,
    termsVersion: packet.version,
    privacyVersion: packet.version,
    changesApplied: 0,
  }),
);
