import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  rosterActivationCommand,
  rosterBatchCommand,
} from "../../src/core/commercial-player-roster";
import {
  dormantCommercialPool,
  validateDormantCommercialPool,
  type DormantPoolDefinition,
} from "../../src/core/commercial-pool-plan";

const path = "docs/qa/current-rosters-20261122/";
const review = JSON.parse(readFileSync(path + "AFL_REVIEW.json", "utf8"));
const batch = rosterBatchCommand.parse(
  JSON.parse(readFileSync(path + "AFL_REVIEWED_EXISTING_BATCH.json", "utf8")),
);

test("prepared AFL update contains only the seven corroborated existing identities with captured source hashes", () => {
  assert.equal(batch.changes.length, 7);
  assert.equal(
    batch.changes.filter((row) => row.registration === "ACTIVE").length,
    2,
  );
  assert.equal(
    batch.changes.filter((row) => row.registration === "PENDING_RELIST").length,
    2,
  );
  const census = JSON.parse(readFileSync(path + "AFL_CENSUS.json", "utf8"));
  for (const change of batch.changes) {
    assert(
      census.players.some((player: any) => player.playerId === change.playerId),
    );
    assert.equal(change.expectedRevision, null);
    assert.equal(change.registerDefinitions, false);
    assert.equal(change.candidate, undefined);
    assert.deepEqual(change.aliases, []);
    const source = review.sources.find(
      (item: any) => item.url === change.source.url,
    );
    assert(
      source,
      "Each proposed decision must name a captured primary source",
    );
    assert.equal(change.source.hash, source.sha256);
    assert.equal(
      Date.parse(change.source.observedAt),
      Date.parse(source.capturedAt),
    );
    if (change.registration === "ACTIVE") {
      assert.equal(change.relistConfirmed, true);
      assert.equal(change.currentClub?.name, "Gold Coast");
    } else assert.equal(change.currentClub, null);
  }
});

test("draft research distinguishes completed selection facts from unverified new permanent identities", () => {
  const candidates = review.nationalDraftCandidates;
  assert.equal(candidates.length, 65);
  assert.equal(new Set(candidates.map((item: any) => item.pick)).size, 65);
  assert.equal(
    candidates.filter(
      (item: any) => item.exactCommercialCanonicalMatches.length === 1,
    ).length,
    2,
  );
  const unresolved = candidates.filter(
    (item: any) =>
      item.candidateKind === "UNRESOLVED_NEW_OR_RETURNING_IDENTITY",
  );
  assert.equal(unresolved.length, 63);
  for (const item of unresolved) {
    assert.equal(item.applyReady, false);
    assert.equal(item.candidate, undefined);
    assert(item.missingForNewIdentity.length > 0);
  }
});

const expectedNewProfiles = new Map([
  ["13934", { name: "Gus Kennedy", club: "Collingwood", pick: 31 }],
  ["13891", { name: "Ethan Drever", club: "Essendon", pick: 2 }],
  ["14658", { name: "Archie Elliott", club: "Essendon", pick: 17 }],
  ["13906", { name: "Lachlan Hicks", club: "Geelong", pick: 38 }],
  ["15318", { name: "Cooper Hodge", club: "Hawthorn", pick: 58 }],
  ["13950", { name: "Arki Butler", club: "Richmond", pick: 4 }],
  ["15314", { name: "Caylen Murray", club: "Sydney", pick: 9 }],
  ["5176", { name: "Mitch Knevitt", club: "Sydney", pick: 48 }],
  ["8950", { name: "Jack Riding", club: "Western Bulldogs", pick: 50 }],
]);
const readArtifact = (name: string) =>
  JSON.parse(readFileSync(path + name, "utf8"));
const preparedNewBatch = () =>
  rosterBatchCommand.parse(readArtifact("AFL_REVIEWED_NEW_BATCH.json"));

test("new AFL batch binds exactly nine observed profile identities without reusing existing players", () => {
  const prepared = preparedNewBatch();
  const plan = readArtifact("AFL_NEW_PLAYER_PLAN.json");
  const census = readArtifact("AFL_CENSUS.json");
  const clubIdentity = readArtifact("CLUB_IDENTITY_EVIDENCE.json");
  const crosscheck = readArtifact("NEW_PLAYER_IDENTITY_CROSSCHECK.json");
  assert.equal(
    crosscheck.localSurnameAndVariantCrosscheck.censusSha256,
    createHash("sha256")
      .update(readFileSync(path + "AFL_CENSUS.json"))
      .digest("hex"),
  );
  assert.equal(crosscheck.aflProviderAliasRows, 0);
  assert.equal(crosscheck.productionWrites, 0);
  for (const registry of [
    "legacyPlayers",
    "permanentIdentities",
    "savedEconomyPlayers",
    "commercialIdentities",
  ]) {
    assert.deepEqual(crosscheck[registry], []);
  }
  const existingIds = new Set(
    census.players.map((player: any) => player.playerId),
  );
  const existingAliases = new Set(
    census.players.flatMap((player: any) =>
      player.providers.map(
        (alias: any) => `${alias.provider}:${alias.providerId}`,
      ),
    ),
  );
  assert.equal(prepared.changes.length, 9);
  assert.equal(plan.entries.length, 9);
  assert.equal(
    new Set(plan.entries.map((entry: any) => entry.playerId)).size,
    9,
  );
  assert.deepEqual(
    new Set(plan.entries.map((entry: any) => entry.providerId)),
    new Set(expectedNewProfiles.keys()),
  );
  assert.deepEqual(
    new Set(prepared.changes.map((change) => change.playerId)),
    new Set(plan.entries.map((entry: any) => entry.playerId)),
  );
  for (const change of prepared.changes) {
    const candidate = change.candidate;
    assert(candidate, "New definition registration requires a candidate");
    const expected = expectedNewProfiles.get(candidate.providerId);
    assert(expected, "Only an observed individual profile ID can be prepared");
    const entry = plan.entries.find(
      (item: any) => item.playerId === change.playerId,
    );
    assert(entry);
    assert.equal(existingIds.has(change.playerId), false);
    assert.equal(
      existingAliases.has(`${candidate.provider}:${candidate.providerId}`),
      false,
    );
    assert.equal(candidate.provider, "afl-public-profile");
    assert.equal(entry.provider, candidate.provider);
    assert.equal(entry.providerId, candidate.providerId);
    assert.equal(candidate.snapshot.name, expected.name);
    assert.equal(entry.name, expected.name);
    assert.equal(entry.club, expected.club);
    assert.equal(entry.pick, expected.pick);
    assert.equal(change.currentClub?.name, expected.club);
    const capturedClub = clubIdentity.rows.find(
      (club: any) => club.name === expected.club,
    );
    assert(capturedClub);
    assert.equal(entry.clubId, capturedClub.id);
    assert.equal(change.currentClub?.id, capturedClub.id);
    assert.equal(capturedClub.id, capturedClub.widgetConfig.clubPid);
    assert.equal(
      capturedClub.precedingOfficialClubBadgeCode.toLowerCase(),
      capturedClub.officialTeamPage.dataTeamAbbr,
    );
    const capturedClubSource = review.sources.find(
      (source: any) => source.url === capturedClub.sourceUrl,
    );
    assert(capturedClubSource);
    assert.equal(capturedClub.sourceSha256, capturedClubSource.sha256);
    assert.equal(
      Date.parse(capturedClub.capturedAt),
      Date.parse(capturedClubSource.capturedAt),
    );
    const identityCheck = crosscheck.localSurnameAndVariantCrosscheck.rows.find(
      (row: any) => row.officialAflProfileId === candidate.providerId,
    );
    assert(identityCheck);
    assert(identityCheck.knownNameVariantsChecked.includes(expected.name));
    assert.deepEqual(identityCheck.candidateOrKnownVariantMatches, []);
    assert.equal(candidate.snapshot.team, expected.club);
    assert.equal(candidate.id, change.playerId);
    assert.equal(change.sport, "afl");
    assert.equal(change.registration, "ACTIVE");
    assert.equal(change.expectedRevision, null);
    assert.equal(change.registerDefinitions, true);
    assert.equal(candidate.snapshot.season, "2026");
    assert.equal(candidate.snapshot.synthetic, false);
    assert.equal(candidate.source.permanentIssuanceEligible, false);
    assert.equal(entry.primaryPosition, candidate.snapshot.position);
    assert.deepEqual(entry.eligiblePositions, candidate.eligiblePositions);
    for (const alias of change.aliases) {
      assert.equal(alias.provider, "afl-public-profile");
      assert.equal(alias.providerId, candidate.providerId);
    }
  }
});

test("new AFL definition artifact is the exact canonical dormant 45-row pool with no supply reset", () => {
  const prepared = preparedNewBatch();
  const plan = readArtifact("AFL_NEW_PLAYER_PLAN.json");
  assert.equal(plan.definitionArtifact, "AFL_NEW_DORMANT_DEFINITIONS.json");
  const definitions: DormantPoolDefinition[] = readArtifact(
    plan.definitionArtifact,
  );
  const recomputed = dormantCommercialPool(
    prepared.changes.map((change) => change.candidate),
  );
  assert.equal(definitions.length, 45);
  assert.equal(
    new Set(definitions.map((definition) => definition.id)).size,
    45,
  );
  assert.deepEqual(
    [...definitions].sort((a, b) => a.id.localeCompare(b.id)),
    [...recomputed].sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.doesNotThrow(() => validateDormantCommercialPool(definitions));
  const census = readArtifact("AFL_CENSUS.json");
  const existingDefinitionIds = new Set(
    census.players.flatMap((player: any) =>
      player.definitions.map((definition: any) => definition.id),
    ),
  );
  const expectedCaps = {
    RARE: 5000,
    ELITE: 2500,
    ULTRA_RARE: 400,
    LEGENDARY: 50,
    ICON: 1,
  };
  for (const change of prepared.changes) {
    const rows = definitions.filter((row) => row.player_id === change.playerId);
    assert.equal(rows.length, 5);
    assert.deepEqual(
      Object.fromEntries(rows.map((row) => [row.rarity, row.lifetime_cap])),
      expectedCaps,
    );
    for (const row of rows) {
      assert.equal(existingDefinitionIds.has(row.id), false);
      assert.equal(row.approved, false);
      assert.equal(row.issued, 0);
      assert.equal(row.legacy_issued, 0);
      assert.equal(row.snapshot.season, "2026");
      assert.match(row.rights_reference, /permanent-issuance-pending$/);
    }
  }
});

test("new AFL player facts and source hashes trace to their exact independent profile and club captures", () => {
  const prepared = preparedNewBatch();
  const plan = readArtifact("AFL_NEW_PLAYER_PLAN.json");
  const researchA = readArtifact("DRAFT_IDENTITY_REVIEW_A.json");
  const researchB = readArtifact("DRAFT_IDENTITY_REVIEW_B.json");
  const sameCapture = (actual: any, expected: any) => {
    assert.equal(actual.url, expected.url);
    assert.equal(actual.sha256, expected.sha256);
    assert.match(actual.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      Date.parse(actual.observedAt),
      Date.parse(expected.observedAt),
    );
    assert(Number.isFinite(Date.parse(actual.observedAt)));
  };
  for (const entry of plan.entries) {
    const a = researchA.rows.find(
      (row: any) => row.officialPlayerProfile?.providerId === entry.providerId,
    );
    const b = researchB.rows.find(
      (row: any) => row.officialProfileEvidence?.id === entry.providerId,
    );
    assert(
      a || b,
      "Prepared identity must exist in independent factual review",
    );
    if (a) {
      const evidence = a.officialPlayerProfile;
      assert.equal(entry.dob, evidence.dob);
      assert.equal(entry.draftName, a.name);
      assert.equal(entry.club, a.selectedClub);
      sameCapture(entry.profileEvidence, evidence);
      sameCapture(entry.clubEvidence, {
        url: evidence.clubSelectionUrl,
        sha256: evidence.clubSelectionSha256,
        observedAt: evidence.clubSelectionObservedAt,
      });
      sameCapture(entry.positionEvidence, {
        url: evidence.positionSourceUrl,
        sha256: evidence.positionSourceSha256,
        observedAt: evidence.positionSourceObservedAt,
      });
      assert.equal(entry.primaryPosition, evidence.primaryPositionCandidate);
      assert.deepEqual(
        entry.eligiblePositions,
        evidence.positionMappingCandidate,
      );
    } else {
      const evidence = b.officialProfileEvidence;
      assert.equal(evidence.factualFieldsCompleteForCanonicalReview, true);
      assert.equal(evidence.conflict, undefined);
      assert.equal(entry.dob, evidence.dob);
      assert.equal(entry.draftName, b.name);
      assert.equal(entry.club, b.selectedClub);
      for (const [field, sourceUrl, capture] of [
        ["profileEvidence", evidence.url, evidence.profileCapture],
        ["clubEvidence", evidence.clubSource, evidence.currentClubCapture],
        ["positionEvidence", evidence.positionSource, evidence.positionCapture],
      ] as const) {
        sameCapture(entry[field], {
          url: sourceUrl,
          sha256: capture.sha256,
          observedAt: capture.capturedAt,
        });
      }
      const factualPositions: Record<string, string[]> = {
        "13950": ["FWD"],
        "15314": ["MID", "DEF"],
        "5176": ["MID"],
        "8950": ["MID"],
      };
      assert(
        factualPositions[entry.providerId].includes(entry.primaryPosition),
      );
      assert(
        entry.eligiblePositions.every((position: string) =>
          factualPositions[entry.providerId].includes(position),
        ),
      );
    }
    assert.equal(
      new URL(entry.profileEvidence.url).pathname.split("/")[2],
      entry.providerId,
    );
    const change = prepared.changes.find(
      (item) => item.playerId === entry.playerId,
    );
    assert(change?.candidate);
    const primaryCapture = [
      entry.profileEvidence,
      entry.clubEvidence,
      entry.positionEvidence,
    ].find((source) => source.url === change.source.url);
    assert(primaryCapture, "Batch source must be one of the reviewed captures");
    assert.equal(change.source.hash, primaryCapture.sha256);
    assert.equal(
      Date.parse(change.source.observedAt),
      Date.parse(primaryCapture.observedAt),
    );
    assert.equal(change.candidate.source.hash, primaryCapture.sha256);
    assert(
      Date.parse(change.source.effectiveAt) <=
        Date.parse(change.source.observedAt),
    );
  }
});

test("all 63 unlinked draft selections partition into nine prepared and 54 pending without activation or duplicate returnees", () => {
  const prepared = preparedNewBatch();
  const plan = readArtifact("AFL_NEW_PLAYER_PLAN.json");
  assert.deepEqual(plan.counts, {
    nationalSelections: 65,
    existingCanonicalReturns: 2,
    preparedNewIdentities: 9,
    remainingSelections: 54,
    dormantDefinitions: 45,
  });
  assert.equal(plan.entries.length, 9);
  assert.equal(plan.pendingSelections.length, 54);
  const selected = review.nationalDraftCandidates.filter(
    (entry: any) =>
      entry.candidateKind === "UNRESOLVED_NEW_OR_RETURNING_IDENTITY",
  );
  const combined = [
    ...plan.entries.map((entry: any) => ({
      pick: entry.pick,
      name: entry.draftName,
      club: entry.club,
    })),
    ...plan.pendingSelections.map((entry: any) => ({
      pick: entry.pick,
      name: entry.name,
      club: entry.selectedClub,
    })),
  ];
  assert.equal(new Set(combined.map((entry) => entry.pick)).size, 63);
  assert.deepEqual(
    combined.sort((a, b) => a.pick - b.pick),
    selected
      .map((entry: any) => ({
        pick: entry.pick,
        name: entry.name,
        club: entry.club,
      }))
      .sort((a: any, b: any) => a.pick - b.pick),
  );
  for (const pending of plan.pendingSelections) {
    assert(pending.status);
    assert(pending.missing.length > 0);
  }
  assert(
    plan.pendingSelections.some((entry: any) => entry.name === "Brady Wright"),
    "Conflicting official DOB evidence must remain pending",
  );
  const returns = batch.changes.filter(
    (change) => change.registration === "ACTIVE",
  );
  assert.deepEqual(
    new Set(returns.map((change) => change.playerId)),
    new Set([
      "88d868a0-d9ce-465f-a16e-751e22aeb135",
      "5f7b2f82-b24f-45d9-a137-c698ba977e42",
    ]),
  );
  for (const returned of returns) {
    assert.equal(returned.registerDefinitions, false);
    assert.equal(returned.candidate, undefined);
    assert(
      !prepared.changes.some((change) => change.playerId === returned.playerId),
    );
  }
  assert.equal(plan.separateActivationRequired, true);
  assert.equal(plan.activationPrepared, false);
  assert.equal(plan.productionWrites, 0);
  assert.equal(rosterActivationCommand.safeParse(prepared).success, false);
  assert.equal(Object.hasOwn(plan, "activationCommands"), false);
  assert.equal(Object.hasOwn(plan, "activationPayload"), false);
  assert.equal(Object.hasOwn(plan, "rightsReference"), false);
});
