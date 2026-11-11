/** Offline proposal only. New UUIDs are explicit proposed commercial identities,
 * not invented claims about existing catalogue records. No database is opened. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dormantCommercialPool, validateDormantCommercialPool } from "../src/core/commercial-pool-plan";
import { issuedInventoryManifest } from "../src/core/issued-inventory-manifest";
import { reconcileLifetimePool } from "../src/core/lifetime-reconciliation";
import { digest } from "../src/core/scoring-engine";
import { jerseyPresentation } from "../src/core/card-presentation";
import { rarityRule } from "../src/core/card-rarity";

const out = "docs/qa/v31-prelaunch-20261111/cards";
const privateOut = "private-data/v31-card-research-20261111";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const write = (name: string, data: unknown) => writeFileSync(`${out}/${name}`, JSON.stringify(data, null, 2) + "\n");
mkdirSync(out, { recursive: true });
mkdirSync(privateOut, { recursive: true });
const paths = {
  census: "private-data/v31-final-reconciliation-20261110/census.private.json",
  issued: "private-data/v31-final-reconciliation-20261110/all-issued.private.json",
  candidate: "private-data/commercial-pool-20261106-v2/candidate.private.json",
  priorMapping: "docs/qa/v31-operational-acceptance-20261110/card-source-mapping.json",
  previousAdditional: "docs/qa/v31-operational-acceptance-20261110/commercial-additional-definitions.json",
  research: `${out}/identity-research.json`,
  lookup: "docs/qa/v31-operational-acceptance-20261110/card-catalogue-lookup.json",
  freshCustody: `${privateOut}/fresh-custody.private.json`,
};
const census = read(paths.census), issued = read(paths.issued), candidate = read(paths.candidate), mapping = read(paths.priorMapping), additional = read(paths.previousAdditional), research = read(paths.research), lookup = read(paths.lookup);
for (const [k, path] of Object.entries({ census: paths.census, allIssued: paths.issued, candidate: paths.candidate }))
  assert.equal(sha(path), mapping.summary.sources[k].sha256, "Preserved source bytes changed; refresh proposal explicitly");
assert.equal(research.recordsReviewed, 71);
assert.equal(research.ambiguousHumanIdentities, 0);
assert.equal(research.sourceApproval, false);
assert.equal(lookup.rows.length, 0, "Existing mappings require reuse, never duplicate registration");
const key = (r: any) => [r.sport, r.provider, r.providerId].join("|");

// RFC 9562 UUIDv5 using the DNS namespace. Versioned name contains only stable
// provider identity, never team, season, display name, position or rarity.
const dnsNamespace = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
const registrationNamespace = "docked.com.au:commercial-historical-player:v1";
function proposedUuid(identity: string) {
  const bytes = createHash("sha1").update(dnsNamespace).update(`${registrationNamespace}:${identity}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const ids = new Map<string, string>();
for (const c of mapping.cards) if (c.canonicalPlayerId) {
  assert(!ids.has(key(c)) || ids.get(key(c)) === c.canonicalPlayerId);
  ids.set(key(c), c.canonicalPlayerId);
}
for (const row of candidate.rows) {
  const k = key({ sport: row.sport, ...row.snapshot });
  assert(!ids.has(k) || ids.get(k) === row.player_id);
  ids.set(k, row.player_id);
}
const registrations = research.records.filter((r: any) => !r.existingCatalogueId).map((r: any) => {
  assert.equal(r.identityConclusion, "ESTABLISHED_EXACT_GSIS_AND_NAME");
  assert.equal(r.exactProviderMatches, 1);
  assert(!ids.has(key(r)));
  const proposedCommercialPlayerId = proposedUuid(key(r));
  assert(![...ids.values()].includes(proposedCommercialPlayerId), "Proposed ID collides with an existing catalogue identity");
  ids.set(key(r), proposedCommercialPlayerId);
  return {
    sport: r.sport, provider: r.provider, providerId: r.providerId, name: r.name,
    proposedCommercialPlayerId,
    existingCatalogueId: null,
    registrationKind: "NEW_COMMERCIAL_ONLY_PROVIDER_IDENTITY_PROPOSAL",
    evidence: r.providerEvidence,
    approved: false, newIssuanceEligible: false,
    note: "No beta catalogue player, edition, card or ownership is created/replaced. Existing historical player IDs remain unchanged. Freeze this exact mapping with source/import approval; never silently remap if a later catalogue identity appears.",
  };
}).sort((a: any, b: any) => key(a).localeCompare(key(b)));
assert.equal(registrations.length, 23);
assert.equal(new Set([...ids.values()]).size, ids.size, "Provider alias collision");
const originalInputs = issued.map((r: any) => ({ id: r.immutableCardId, sport: r.sport, playerId: r.playerId, provider: r.provider, providerId: r.providerId, rarity: r.rarity, serial: r.serial }));
const originalManifest = issuedInventoryManifest(originalInputs);
assert.equal(originalManifest.totalIssued, 879);
assert.equal(originalManifest.digest, mapping.summary.manifestDigest);
const fresh = read(paths.freshCustody);
assert.equal(fresh.originalRecordsUnchanged, 897);
assert.equal(fresh.additionalRealPlayerCopies, 9);
assert.equal(fresh.supportedLimitedCopiesNow, 888);
assert.equal(fresh.additionalIssued.length, 9);
assert.equal(fresh.priorProtectedCustodyDigest, digest(census.records.map((r: any) => ({ id: r.id, custody: r.custody, ownership: r.ownership, doc: r.doc, locations: r.locations })).sort((a: any, b: any) => a.id.localeCompare(b.id))));
assert.equal(fresh.protectedCustodyDigest, digest(fresh.records));
const manifest = issuedInventoryManifest([...originalInputs, ...fresh.additionalIssued]);
assert.equal(manifest.totalIssued, 888);
assert.equal(issued.filter((r: any) => r.priorRetirement).length, 8);
const baseline = manifest.rows.map((g) => ({ sport: g.sport, player_id: g.playerId, provider: g.provider, provider_id: g.providerId, rarity: g.rarity, issued: g.issued, max_serial: g.serials.at(-1)! }));
const newKeys = new Set(registrations.map(key));
const newDefinitions = manifest.rows.filter(g => newKeys.has(key(g))).map(g => {
  const r = census.records.find((r: any) => r.id === g.allocations[0].id);
  assert(r && r.player.providerId === g.providerId && r.player.sport === g.sport);
  const p = r.player;
  const generated = dormantCommercialPool([{
    id: ids.get(key(g)), sport: g.sport, provider: g.provider, providerId: g.providerId,
    snapshot: { name: p.name, team: p.currentTeam, position: p.position, season: "2026", verifiedJerseyNumber: p.verifiedJerseyNumber ?? null, colour: jerseyPresentation({ sport: "nfl", team: p.currentTeam }).primary, status: p.status, synthetic: false },
    eligiblePositions: [p.position],
    source: { url: p.roster.sourceUrl, hash: p.roster.sourceHash, checkedAt: new Date(p.roster.checkedAt).toISOString(), license: "factual-roster-observation; owner-confirmed-name-use", verification: "preserved-historical-baseline-only; exact-GSIS-research; proposed-commercial-UUID-registration; no-current-eligibility-approval", permanentIssuanceEligible: false },
  }]);
  return generated.find(r => r.rarity === g.rarity)!;
}).sort((a, b) => a.id.localeCompare(b.id));
assert.equal(newDefinitions.length, 24);
const sourceRows = [...candidate.rows, ...additional.sourceRows, ...newDefinitions].sort((a, b) => a.id.localeCompare(b.id));
validateDormantCommercialPool(sourceRows);
assert.equal(sourceRows.length, 6540);
const complete = reconcileLifetimePool(sourceRows, baseline);
assert(complete.importReady);
assert.equal(complete.unmatched.length, 0);
assert.equal(complete.legacyIssued, 888);
assert.equal(digest(complete), digest(reconcileLifetimePool(sourceRows, baseline)), "Offline rebuild differs");
assert(sourceRows.every(r => !r.approved && !r.snapshot.source.permanentIssuanceEligible));
const caps = { CORE: null, RARE: 5000, ELITE: 2500, ULTRA_RARE: 400, LEGENDARY: 50, ICON: 1 };
for (const [rarity, cap] of Object.entries(caps)) assert.equal(rarityRule(rarity as never).lifetimeCap, cap);
const plan = {
  version: "v31-complete-preservation-only-inventory-proposal-v1",
  projectRef: "pojoymtniryarxxunyvz", productionApproved: false, sourceSnapshotApproved: false,
  sourceRows, priorIssuance: baseline, rows: complete.rows,
  registrationNamespace, registrations, registrationDigest: digest(registrations),
  sourceRowsDigest: digest(sourceRows), expectedRowsDigest: digest(complete.rows), reconciliationDigest: complete.digest,
  issuedManifestDigest: manifest.digest,
  protectedCustodyDigest: fresh.protectedCustodyDigest,
  sources: Object.fromEntries(Object.entries(paths).map(([k, file]) => [k, { file, sha256: sha(file) }])),
};
const planPath = `${privateOut}/complete-proposal.private.json`;
writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
write("identity-registrations.proposed.json", { approved: false, namespace: registrationNamespace, algorithm: "RFC9562 UUIDv5 DNS namespace + versioned provider key", registrationDigest: plan.registrationDigest, registrations });
write("additional-24-source-definitions.json", { approved: false, sourceRows: newDefinitions });
const summary = {
  version: plan.version, productionWrites: 0, productionImportApproved: false,
  preservationSourceApprovalPending: true, currentEligibilityApproved: false,
  completeForIsolatedRehearsal: true, identitiesResearched: 71, ambiguousHumanIdentities: 0,
  proposedNewCommercialIdentityRegistrations: 23,
  definitions: sourceRows.length, lifetimeConsumedCopies: complete.legacyIssued,
  existingCopies: manifest.totalIssued, preservedRetiredCopies: 8, issuedGroups: manifest.rows.length,
  original879CopiesPreserved: true, additionalRealAflTestCopiesIncluded: 9, hiddenNbaCopiesExcluded: 18,
  unresolvedDefinitions: complete.unmatched.length,
  newMintedCards: 0, deletedCards: 0, remintedCards: 0, changedOwners: 0, approvedDefinitions: 0, availableStock: 0, reservedStock: 0,
  permanentCaps: { ...caps, CORE: "unlimited" },
  issuedManifestDigest: plan.issuedManifestDigest, sourceRowsDigest: plan.sourceRowsDigest,
  expectedRowsDigest: plan.expectedRowsDigest, reconciliationDigest: plan.reconciliationDigest,
  registrationDigest: plan.registrationDigest, protectedCustodyDigest: plan.protectedCustodyDigest,
  completePrivatePlan: { file: planPath, sha256: sha(planPath) },
  sources: plan.sources,
  assembly: `Pinned candidate sourceRows + previous additional51 sourceRows + new additional24 sourceRows, sorted by definition ID; pass exact${manifest.rows.length} issued baselines to importer. Expected6540 rows consume888 lifetime copies, including all original879 and9 new real AFL TEST copies. Never import sourceRows without priorIssuance. All definitions remain unapproved and no cards are inserted.`,
  approvalGroup: "Accept preservation-only historical source baselines and the exact23 commercial-only provider registrations; no current eligibility, source-rights expansion, new stock, beta-player/edition creation or owner changes. Production inventory import requires a separate exact-digest approval after fresh restored rehearsal.",
};
write("complete-import-review.json", summary);
write("issued-lifetime-manifest.json", { ...manifest, currentEligibilityApproved: false });
console.log(JSON.stringify(summary, null, 2));
