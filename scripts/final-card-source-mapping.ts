/** Offline review only: consumes pinned source snapshots, never opens a database.
 * Null catalogue IDs are explicit blockers, never generated from names. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { issuedInventoryManifest } from "../src/core/issued-inventory-manifest";
import { reconcileLifetimePool } from "../src/core/lifetime-reconciliation";
import { digest } from "../src/core/scoring-engine";
import {
  dormantCommercialPool,
  validateDormantCommercialPool,
} from "../src/core/commercial-pool-plan";
import { jerseyPresentation } from "../src/core/card-presentation";
import { teamColours } from "../src/core/sport-team-colours";

const sourceFiles = {
  census: "private-data/v31-final-reconciliation-20261110/census.private.json",
  allIssued:
    "private-data/v31-final-reconciliation-20261110/all-issued.private.json",
  candidate: "private-data/commercial-pool-20261106-v2/candidate.private.json",
  archive: "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
  previousProposal:
    "docs/qa/v31-final-reconciliation-20261110/inventory-source-proposal.json",
  paletteRules: "src/core/card-presentation.ts",
  australianPaletteRules: "src/core/sport-team-colours.ts",
  independentCatalogueLookup:
    "docs/qa/v31-operational-acceptance-20261110/card-catalogue-lookup.json",
};
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const sha = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const census = read(sourceFiles.census),
  issued = read(sourceFiles.allIssued),
  candidate = read(sourceFiles.candidate),
  archive = read(sourceFiles.archive),
  previous = read(sourceFiles.previousProposal);
assert.equal(sha(sourceFiles.census), previous.sourceSnapshotSha256);
assert.equal(sha(sourceFiles.candidate), previous.originalCandidateSha256);
assert.equal(issued.length, 879);
assert.equal(candidate.rows.length, 6465);
const out = "docs/qa/v31-operational-acceptance-20261110";
mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) =>
  writeFileSync(`${out}/${name}`, JSON.stringify(data, null, 2) + "\n");
const providerKey = (r: any) => [r.sport, r.provider, r.providerId].join("|");
const canonicalPlayers = new Map<string, any>();
for (const row of candidate.rows) {
  const key = providerKey({ ...row.snapshot, sport: row.sport });
  const old = canonicalPlayers.get(key);
  if (old)
    assert.equal(
      old.player_id,
      row.player_id,
      "Candidate provider alias conflict",
    );
  canonicalPlayers.set(key, row);
}
const archivePlayers = new Map<string, any>();
for (const p of archive.players) {
  const key = providerKey(p);
  assert(!archivePlayers.has(key), "Archived provider identity is ambiguous");
  archivePlayers.set(key, p);
}
const capturedEvidenceDigests = new Set(
  census.evidence.map((e: any) => digest(e)),
);
const cards = issued
  .map((r: any) => {
    const captured = census.records.find(
      (c: any) => c.id === r.immutableCardId,
    );
    assert(captured, "Every mapped card must exist in the pinned census");
    assert.equal(captured.doc.serial, r.serial);
    assert.equal(captured.doc.rarity, r.rarity);
    assert.equal(captured.doc.playerId, r.playerId);
    assert.equal(captured.player.provider, r.provider);
    assert.equal(captured.player.providerId, r.providerId);
    assert.equal(captured.player.sport, r.sport);
    assert.equal(captured.custody?.owner ?? null, r.owner);
    assert.equal(captured.locations.includes("retired"), !!r.priorRetirement);
    if (r.currentSource)
      assert(
        capturedEvidenceDigests.has(digest(r.currentSource)),
        "Full source witness must belong to the pinned census evidence",
      );
    const key = providerKey(r),
      proposed = canonicalPlayers.get(key),
      historical = archivePlayers.get(key),
      evidence = r.sport === "nfl" ? r.currentSource : null;
    if (evidence) assert.equal(evidence.provider_id, r.providerId);
    const witnesses = [
      ...(proposed
        ? [{ kind: "exact-candidate-provider", id: proposed.player_id }]
        : []),
      ...(evidence?.catalogue_id
        ? [{ kind: "captured-catalogue-provider", id: evidence.catalogue_id }]
        : []),
      ...(historical
        ? [
            {
              kind: "archived-wikidata-provider",
              id: historical.fixturePlayerId,
            },
          ]
        : []),
    ];
    const ids = new Set(witnesses.map((w) => w.id));
    assert(
      ids.size <= 1,
      "Canonical source witnesses disagree; manual identity review required",
    );
    const canonicalPlayerId = witnesses[0]?.id ?? null;
    if (canonicalPlayerId)
      assert.match(
        canonicalPlayerId,
        /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i,
      );
    const issues: string[] = [];
    if (!canonicalPlayerId) issues.push("APPROVED_CATALOGUE_UUID_REQUIRED");
    if (!proposed) issues.push("ABSENT_FROM_PINNED_COMMERCIAL_SOURCE");
    if (evidence && !evidence.identity_verified)
      issues.push("CURRENT_ROSTER_IDENTITY_NOT_VERIFIED");
    if (evidence && evidence.status !== "active")
      issues.push("CURRENT_ROSTER_NOT_ACTIVE");
    if (r.priorRetirement) issues.push("KEEP_PRIOR_APPROVED_RETIREMENT");
    if (!proposed && historical)
      issues.push("ARCHIVED_IDENTITY_ONLY_REFRESH_ELIGIBILITY");
    return {
      immutableCardId: r.immutableCardId,
      player: r.player,
      sport: r.sport,
      historicalPlayerId: r.playerId,
      provider: r.provider,
      providerId: r.providerId,
      canonicalPlayerId,
      mappingWitnesses: witnesses,
      rarity: r.rarity,
      serial: r.serial,
      lifetimeCap: r.lifetimeCap,
      allocationPreserved: true,
      existingCustodyPreserved: true,
      previouslyRetired: !!r.priorRetirement,
      countedInOriginalCandidate: !!proposed,
      sourceApproval: false,
      newIssuanceEligible: false,
      latestCapturedEvidence: evidence
        ? {
            sourceUrl: evidence.source_url,
            sourceHash: evidence.source_hash,
            checkedAt: evidence.checked_at,
            identityVerified: evidence.identity_verified,
            rosterStatus: evidence.status,
          }
        : historical
          ? {
              sourceUrl: historical.rosterBeta.profileSource,
              sourceHash: historical.rosterBeta.sourceHash,
              checkedAt: historical.rosterBeta.verifiedAt,
              identityVerified: null,
              rosterStatus: "historical-snapshot-only",
            }
          : null,
      issues,
    };
  })
  .sort((a: any, b: any) => a.immutableCardId.localeCompare(b.immutableCardId));
const manifest = issuedInventoryManifest(
  cards.map((r: any) => ({
    id: r.immutableCardId,
    sport: r.sport,
    playerId: r.historicalPlayerId,
    provider: r.provider,
    providerId: r.providerId,
    rarity: r.rarity,
    serial: r.serial,
  })),
);
assert.equal(manifest.totalIssued, 879);
const groups = manifest.rows.map((g) => {
  const same = cards.filter(
    (r: any) => providerKey(r) === providerKey(g) && r.rarity === g.rarity,
  );
  assert.equal(same.length, g.issued);
  const p = canonicalPlayers.get(providerKey(g));
  const row = p
    ? candidate.rows.find(
        (r: any) =>
          r.sport === g.sport &&
          r.player_id === p.player_id &&
          r.rarity === g.rarity,
      )
    : null;
  return {
    ...g,
    historicalPlayerId: g.playerId,
    canonicalPlayerId: same[0].canonicalPlayerId,
    definitionId: row?.id ?? null,
    originalCandidateDefinition: !!row,
    sourceApproval: false,
    newIssuanceEligible: false,
  };
});
const baseline = groups.map((g) => ({
  sport: g.sport,
  player_id: g.playerId,
  provider: g.provider,
  provider_id: g.providerId,
  rarity: g.rarity,
  issued: g.issued,
  max_serial: g.serials.at(-1)!,
}));
const reconciled = reconcileLifetimePool(candidate.rows, baseline);
assert.equal(reconciled.legacyIssued, 793);
assert.equal(reconciled.unmatched.length, 75);
// Existing UUIDs and preserved source fields allow exact dormant rows to be
// prepared now. Only the previously issued rarities are added; no new stock or
// active-roster approval is implied. The other 24 groups remain explicit holes.
const additionalSourceDefinitions = groups
  .filter((g) => !g.originalCandidateDefinition && g.canonicalPlayerId)
  .map((g) => {
    const raw = census.records.find((r: any) => r.id === g.allocations[0].id);
    const archived = archivePlayers.get(providerKey(g));
    const p = raw.player;
    const metadata =
      g.sport === "nfl"
        ? {
            snapshot: {
              name: p.name,
              team: p.currentTeam,
              position: p.position,
              season: "2026",
              verifiedJerseyNumber: p.verifiedJerseyNumber ?? null,
              colour: jerseyPresentation({ sport: "nfl", team: p.currentTeam })
                .primary,
              status: p.status,
              synthetic: false,
            },
            eligiblePositions: [p.position],
            source: {
              url: p.roster.sourceUrl,
              hash: p.roster.sourceHash,
              checkedAt: new Date(p.roster.checkedAt).toISOString(),
              license: "factual-roster-observation; owner-confirmed-name-use",
              verification:
                "preserved-historical-baseline-only; existing-UUID-provider-witness; no-current-eligibility-approval",
              permanentIssuanceEligible: false,
            },
          }
        : (() => {
            assert(
              archived,
              "Existing archived source required for AFL addition",
            );
            const palette = teamColours("afl", archived.currentTeam);
            assert(palette, "Existing presentation palette required");
            return {
              snapshot: {
                name: archived.name,
                team: archived.currentTeam,
                position: archived.position,
                season: "2026",
                verifiedJerseyNumber: null,
                colour: palette.primary,
                accentColour: palette.accent,
                status: archived.status,
                synthetic: false,
              },
              eligiblePositions: archived.eligiblePositions,
              source: {
                url: archived.rosterBeta.profileSource,
                hash: archived.rosterBeta.sourceHash,
                checkedAt: archived.rosterBeta.verifiedAt,
                license: archived.rosterBeta.license,
                verification:
                  "preserved-historical-baseline-only; archived-exact-Wikidata-UUID; no-current-eligibility-approval",
                permanentIssuanceEligible: false,
              },
            };
          })();
    const generated = dormantCommercialPool([
      {
        id: g.canonicalPlayerId,
        sport: g.sport,
        provider: g.provider,
        providerId: g.providerId,
        ...metadata,
      },
    ]);
    const row = generated.find((r) => r.rarity === g.rarity);
    assert(row, "Exact existing rarity contract required");
    g.definitionId = row.id;
    return row;
  })
  .sort((a, b) => a.id.localeCompare(b.id));
assert.equal(additionalSourceDefinitions.length, 51);
const combinedSourceDefinitions = [
  ...candidate.rows,
  ...additionalSourceDefinitions,
];
validateDormantCommercialPool(combinedSourceDefinitions);
const combined = reconcileLifetimePool(combinedSourceDefinitions, baseline);
assert.equal(combined.legacyIssued, 853);
assert.equal(combined.unmatched.length, 24);
const additionalIds = new Set(additionalSourceDefinitions.map((r) => r.id));
const additionalProposedDefinitions = combined.rows.filter((r) =>
  additionalIds.has(r.id),
);
write("commercial-additional-definitions.json", {
  approved: false,
  executableAsPartialImport: false,
  sourceApproval: false,
  explanation:
    "Exact 51 additional source rows and their nonzero lifetime baseline results. UUIDs and metadata come only from existing pinned records; definition IDs use the existing deterministic namespace. Snapshot season 2026 is a presentation label, never a new lifetime pool. Historical snapshot status is not refreshed roster eligibility. Null jersey number makes no factual number claim. Do not import this incomplete proposal.",
  sourceRows: additionalSourceDefinitions,
  proposedRows: additionalProposedDefinitions,
  proposedRowsDigest: digest(additionalProposedDefinitions),
});
const missing = cards.filter((r: any) => !r.canonicalPlayerId);
const lookup = read(sourceFiles.independentCatalogueLookup);
assert.deepEqual(
  [...new Set(missing.map((r: any) => r.providerId))].sort(),
  [...lookup.requestedProviderIds].sort(),
);
assert.equal(
  lookup.rows.length,
  0,
  "Independent provider lookup found mappings; review before reporting unresolved identities",
);
const decisions = new Map<string, any>();
for (const r of cards.filter((r: any) => r.issues.length > 0)) {
  const key = providerKey(r);
  const old = decisions.get(key) ?? {
    sport: r.sport,
    player: r.player,
    provider: r.provider,
    providerId: r.providerId,
    historicalPlayerId: r.historicalPlayerId,
    proposedCanonicalPlayerId: r.canonicalPlayerId,
    issues: r.issues,
    evidence: r.latestCapturedEvidence,
    founderDecision: "PENDING",
    requiredAction: r.canonicalPlayerId
      ? "Review exact existing-provider mapping for historical baseline; preserve custody and consumed serials. Keep new issuance disabled until refreshed source/eligibility approval."
      : "Supply an approved existing catalogue UUID with exact provider evidence, or separately approve a stable identity registration design. Do not infer UUIDs, merge by name, replace cards or release consumed serials.",
    allocations: [],
  };
  old.issues = [...new Set([...old.issues, ...r.issues])].sort();
  old.allocations.push({
    immutableCardId: r.immutableCardId,
    rarity: r.rarity,
    serial: r.serial,
    lifetimeCap: r.lifetimeCap,
    previouslyRetired: r.previouslyRetired,
    countedInOriginalCandidate: r.countedInOriginalCandidate,
  });
  decisions.set(key, old);
}
const summary = {
  sourceCapturedAt: census.capturedAt,
  productionWrites: 0,
  productionImport: false,
  existingIssuedCopies: cards.length,
  preservedOwned: cards.filter((r: any) => !r.previouslyRetired).length,
  preservedRetired: cards.filter((r: any) => r.previouslyRetired).length,
  issuedGroups: groups.length,
  exactCatalogueMappedCopies: cards.length - missing.length,
  newlyResolvedCopies: cards.filter(
    (r: any) => r.canonicalPlayerId && !r.countedInOriginalCandidate,
  ).length,
  unresolvedCatalogueCopies: missing.length,
  unresolvedCataloguePlayers: new Set(missing.map(providerKey)).size,
  unresolvedCatalogueGroups: groups.filter((g) => !g.canonicalPlayerId).length,
  founderSourceReviewPlayers: decisions.size,
  founderSourceReviewCopies: [...decisions.values()].reduce(
    (n, r) => n + r.allocations.length,
    0,
  ),
  candidateDefinitions: candidate.rows.length,
  candidatePlayers: canonicalPlayers.size,
  matchedBaselineCopies: reconciled.legacyIssued,
  additionalHistoricalGroups: groups.filter(
    (g) => !g.originalCandidateDefinition,
  ).length,
  additionalMappedHistoricalGroups: groups.filter(
    (g) => !g.originalCandidateDefinition && g.canonicalPlayerId,
  ).length,
  conditionalDefinitionTotal:
    candidate.rows.length + reconciled.unmatched.length,
  fullySpecifiedDormantDefinitions: combined.rows.length,
  fullySpecifiedLifetimeBaselineCopies: combined.legacyIssued,
  unresolvedDefinitionRows: combined.unmatched.length,
  resolvedProposalDigest: combined.digest,
  exactExecutableImportAvailable: false,
  sourceEligibilityApproved: false,
  proposedMintedCards: 0,
  proposedOwnerChanges: 0,
  proposedDeletedCards: 0,
  proposedRemintedCards: 0,
  approvedCommercialAvailable: 0,
  unissuedReserved: 0,
  hiddenNBAExcludedCopies: census.records.length - cards.length,
  manifestVersion: "id-serial-bound-lifetime-manifest-v2",
  manifestDigest: manifest.digest,
  allCardMappingDigest: digest(cards),
  permanentCaps: {
    CORE: "unlimited",
    RARE: 5000,
    ELITE: 2500,
    ULTRA_RARE: 400,
    LEGENDARY: 50,
    ICON: 1,
  },
  sources: Object.fromEntries(
    Object.entries(sourceFiles).map(([k, file]) => [
      k,
      { file, sha256: sha(file) },
    ]),
  ),
};
write("card-source-mapping.json", { summary, cards });
write("card-founder-decisions.json", {
  sourceCapturedAt: census.capturedAt,
  sourceApproval: false,
  records: [...decisions.values()].sort((a, b) =>
    providerKey(a).localeCompare(providerKey(b)),
  ),
});
write("commercial-import-review.json", {
  version: "blocked-exact-lifetime-import-review-v2",
  approved: false,
  importEnabled: false,
  executable: false,
  summary,
  assembly:
    "Use the exact pinned candidate source bytes plus commercial-additional-definitions.json sourceRows as input; apply these lifetime baselines by exact provider identity. 6516 definitions are fully specified and account for 853 copies. The final 24 historical groups lack approved catalogue UUIDs and are not executable definitions. Never import a partial baseline. No ownership/card INSERT/UPDATE/DELETE is proposed.",
  blockers: [
    "24 historical rarity groups lack an approved catalogue UUID",
    "51 exact additional historical definitions are prepared, unapproved and require founder source-snapshot acceptance",
    "All source/eligibility approvals and a fresh census remain pending",
    "Production importer intentionally rejects environment other than acceptance",
  ],
  proposedLifetimeBaselines: groups,
  unresolvedFields: groups
    .filter((g) => !g.canonicalPlayerId)
    .map((g) => ({
      sport: g.sport,
      provider: g.provider,
      providerId: g.providerId,
      historicalPlayerId: g.playerId,
      rarity: g.rarity,
      allocations: g.allocations,
      missing: [
        "approved canonical player UUID; definition ID is derivable only after that identity is approved",
      ],
      sourceSnapshotAcceptance:
        "Historical source metadata is available; current eligibility is not approved. Do not invent a replacement identity.",
    })),
});
write("card-mapping-summary.json", summary);
console.log(JSON.stringify(summary, null, 2));
