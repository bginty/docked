import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { digest } from "../src/core/scoring-engine";
import { cleanTestEconomy } from "../src/core/nfl-test-cleanup";
import { eligibleCatalogue } from "../src/core/card-economy";
import {
  nflCardEligibility,
  type NflRosterEvidence,
} from "../src/core/nfl-card-eligibility";
import {
  reviewTestingIdentities,
  type TestingPositionReview,
} from "../src/server/nfl-testing-identities";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  if (process.env.VERCEL) throw Error("Isolated filesystem copy only");
  const read = async (p: string) => JSON.parse(await readFile(p, "utf8"));
  const out = "docs/qa/nfl-roster-reconciliation",
    privateOut = "private-data/nfl-roster-reconciliation";
  const audit = await read(`${out}/reconciliation.json`),
    source = await read(`${privateOut}/source.json`);
  const raw = await readFile(
    "private-data/nfl-roster-audit/cleaned-local-copy.json",
    "utf8",
  );
  const clean = JSON.parse(raw),
    original: CreditsState = clean.tables["credits_sandbox.state"][0].document;
  const hash = createHash("sha256").update(raw).digest("hex");
  await mkdir(`${privateOut}/recovery`, { recursive: true });
  const saveOnce = async (path: string, body: string) => {
    try {
      await writeFile(path, body, { flag: "wx", mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      assert.equal(await readFile(path, "utf8"), body);
    }
  };
  await saveOnce(`${privateOut}/recovery/${hash}.json`, raw);
  const candidates = audit.records.filter((p: any) =>
    ["unsupported", "released", "retired"].includes(p.decision),
  );
  const affected = Object.values(original.economy!.instances).filter((c) =>
    candidates.some((p: any) => p.id === c.playerId),
  );
  // This run has no further positively-ineligible owned cards. A future changed
  // preimage requires the existing domain-aware cleanup runner and new manifest.
  assert.equal(
    affected.length,
    0,
    "New removal scope needs a separate reviewed dependency manifest",
  );
  const validated = cleanTestEconomy(original, []);
  assert.equal(digest(validated.state), digest(original));
  const manifest = {
    scope: "isolated-local",
    baseSnapshotSha256: audit.summary.snapshotSha256,
    preimageSha256: hash,
    removedPlayers: [],
    removedCards: [],
    removedOwnership: [],
    dependentRecords: [],
    creditsIssued: 0,
    cardsIssued: 0,
    reason:
      "No additional confirmed ineligible owned assets after accepted cleanup",
  };
  await saveOnce(
    `${privateOut}/recovery/${hash}-removal-manifest.json`,
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(
    `${out}/additional-removal-manifest.json`,
    JSON.stringify(manifest, null, 2),
  );
  const s = structuredClone(original),
    economy = s.economy!;
  economy.rosterPolicy = "official-nfl-roster-v1";
  const statuses: Record<string, NflRosterEvidence["status"]> = {
    eligible: "active",
    unsupported: "active",
    "practice-squad": "practice-squad",
    reserve: "reserve",
    released: "released",
    retired: "retired",
  };
  for (const p of Object.values(economy.players)) {
    const r = audit.records.find((r: any) => r.id === p.id),
      status = statuses[r?.decision];
    if (r?.correctedPosition) {
      assert.equal(r.definitions, 0);
      assert.equal(r.cardIds.length, 0);
      p.position = r.correctedPosition;
    }
    if (!r || !status) {
      delete p.roster;
      p.status = "unknown";
      continue;
    }
    const evidence =
      r.official ??
      (typeof r.verification === "object"
        ? r.verification
        : r.transactions.find((t: any) => t.team === r.sourceTeam));
    if (!evidence) {
      delete p.roster;
      p.status = "unknown";
      continue;
    }
    p.roster = {
      policy: "official-nfl-roster-v1",
      playerId: p.id,
      providerId: p.providerId,
      team: r.official?.team ?? r.sourceTeam,
      position: r.official?.position ?? r.position,
      status,
      identityVerified: true,
      sourceUrl: evidence.url,
      sourceHash: evidence.sha256,
      checkedAt: Date.parse(evidence.checkedAt),
    };
    p.status =
      status === "active"
        ? "active"
        : status === "retired"
          ? "retired"
          : "inactive";
    p.currentTeam = p.roster.team;
    p.observedAt = p.roster.checkedAt;
    p.sourceRevision = p.roster.sourceHash;
  }
  const now = Date.now(),
    eligible = Object.values(economy.players).filter(
      (p) => nflCardEligibility(p, now).eligible,
    );
  const positionReviews: TestingPositionReview[] = eligible.flatMap((p) => {
    const ids = source.identities.filter(
      (i: any) => i.external_id === p.providerId,
    );
    if (ids.length !== 1 || ids[0].position === p.position) return [];
    const r = audit.records.find((r: any) => r.id === p.id);
    assert.equal(r.statistics.status, "matched-statistical-identity");
    return [
      {
        providerId: p.providerId,
        canonical: ids[0].canonical_id,
        sourcePosition: ids[0].position,
        fantasyPosition: p.position,
        officialPosition: p.roster!.position,
        sourceUrl: p.roster!.sourceUrl,
        sourceHash: p.roster!.sourceHash,
        reason:
          p.position === "RB"
            ? "Existing fantasy RB encompasses official FB/HB; no gameplay rule changed"
            : "Stable ID and current official offensive role reviewed; retain raw historical position and score offensive fields only",
      },
    ];
  });
  const bridge = reviewTestingIdentities(
    eligible,
    source.identities,
    positionReviews,
  );
  assert.equal(bridge.approved.length, 433);
  assert.equal(bridge.noAppearances.length, 60);
  assert.equal(bridge.quarantined.length, 0);
  for (const field of [
    "instances",
    "definitions",
    "packs",
    "products",
    "retiredTestInstances",
  ] as const)
    assert.equal(
      digest(economy[field] ?? {}),
      digest(original.economy![field] ?? {}),
    );
  for (const field of [
    "journal",
    "lots",
    "cards",
    "commerce",
    "listings",
    "swaps",
  ] as const)
    assert.equal(digest(s[field]), digest(original[field]));
  const uncertain = audit.records.filter((p: any) =>
    ["quarantine", "reserve-review", "position-review"].includes(p.decision),
  );
  const uncertainOwned = Object.values(economy.instances).filter((c) =>
    uncertain.some((p: any) => p.id === c.playerId),
  );
  assert.equal(uncertainOwned.length, 0);
  const tables = clean.tables as Record<string, any[]>;
  const legacyCards = tables["beta_fantasy.cards"];
  const legacyEditions = tables["beta_fantasy.editions"];
  const uncertainIds = new Set(uncertain.map((p: any) => p.id));
  const uncertainLegacy = legacyCards.filter((c) =>
    uncertainIds.has(
      legacyEditions.find((e) => e.id === c.edition_id)?.player_id,
    ),
  );
  assert.equal(uncertainLegacy.length, 0);
  const liveCardIds = new Set([
    ...legacyCards.map((c) => c.id),
    ...Object.keys(economy.instances),
  ]);
  const checks: Record<string, number> = {};
  const checkRefs = (label: string, ids: string[]) => {
    checks[label] = ids.length;
    assert.ok(
      ids.every((id) => liveCardIds.has(id)),
      `Orphan in ${label}`,
    );
  };
  for (const c of legacyCards)
    assert.ok(legacyEditions.some((e) => e.id === c.edition_id));
  for (const e of legacyEditions)
    assert.ok(tables["beta_fantasy.players"].some((p) => p.id === e.player_id));
  for (const table of [
    "ownership_events",
    "pack_items",
    "listings",
    "trade_items",
  ])
    checkRefs(
      table,
      tables[`beta_fantasy.${table}`].map((r) => r.card_id).filter(Boolean),
    );
  checkRefs(
    "entries",
    tables["beta_fantasy.entries"].flatMap((r) => r.cards),
  );
  checkRefs(
    "drafts",
    tables["beta_fantasy.round_drafts"].flatMap((r) =>
      r.selections.map((s: any) => s.card),
    ),
  );
  checkRefs(
    "locks",
    tables["beta_fantasy.slot_locks"].map((r) => r.snapshot.card_id),
  );
  checkRefs(
    "swaps",
    tables["beta_fantasy.swaps"]
      .flatMap((r) => [r.give_card, r.take_card])
      .filter(Boolean),
  );
  const lineupSnapshots = [
    ...tables["beta_fantasy.entries"].flatMap((r) => r.snapshot),
    ...tables["beta_fantasy.slot_locks"].map((r) => r.snapshot),
  ];
  const uncertainSelections = lineupSnapshots.filter((s) =>
    uncertainIds.has(s.player_id),
  );
  assert.equal(uncertainSelections.length, 0);
  const acceptedManifest = await read(
    "docs/qa/nfl-roster-audit/removal-manifest.json",
  );
  assert.ok(
    acceptedManifest.cardIds.every((id: string) => !liveCardIds.has(id)),
  );
  const pools = (
    economy.activeProductVersions ?? Object.keys(economy.products)
  ).map((id) => ({
    product: id,
    players: eligibleCatalogue(economy, economy.products[id], now).length,
  }));
  for (const product of Object.values(economy.products))
    assert.ok(
      eligibleCatalogue(economy, product, now).every(
        (p) => !uncertain.some((r: any) => r.id === p.id),
      ),
    );
  const db = new PGlite(
    `tmp/nfl-reconciled-catalogue-${digest(audit).slice(0, 16)}`,
  );
  try {
    await db.exec(
      "create schema if not exists reconciliation;create table if not exists reconciliation.prepared(id text primary key,document jsonb not null);create table if not exists reconciliation.audit(id text primary key,document jsonb not null)",
    );
    await db.transaction(async (tx) => {
      await tx.query(
        "insert into reconciliation.prepared values('state',$1) on conflict do nothing",
        [s],
      );
      await tx.query(
        "insert into reconciliation.audit values($1,$2) on conflict do nothing",
        [hash, manifest],
      );
      assert.equal(
        digest(
          (
            await tx.query<{ document: CreditsState }>(
              "select document from reconciliation.prepared where id='state'",
            )
          ).rows[0].document,
        ),
        digest(s),
      );
    });
  } finally {
    await db.close();
  }
  await writeFile(
    `${privateOut}/prepared-local-state.json`,
    JSON.stringify(s),
    { mode: 0o600 },
  );
  await writeFile(
    `${out}/position-reviews.json`,
    JSON.stringify(positionReviews, null, 2),
  );
  await writeFile(
    `${out}/eligible-catalogue.json`,
    JSON.stringify(
      eligible.map((p) => ({
        id: p.id,
        name: p.name,
        providerId: p.providerId,
        position: p.position,
      })),
      null,
      2,
    ),
  );
  await writeFile(
    `${out}/reviewed-feed-mappings.json`,
    JSON.stringify(
      {
        dataset: source.meta.dataset_id,
        reviewer: "local-roster-reconciliation-2026-10-17",
        players: bridge.approved.map((m) => ({
          ...m,
          evidence: {
            identitySource:
              "Retained stable provider ID + official roster reconciliation",
            verifiedIdentity: m.verifiedIdentity,
            verifiedAt: audit.summary.at,
            positionReview:
              positionReviews.find(
                (r) => r.providerId === m.verifiedIdentity,
              ) ?? null,
          },
        })),
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${out}/local-verification.json`,
    JSON.stringify(
      {
        scope: "isolated-local-copy",
        recoverySnapshot: hash,
        originalRemovalAuditPreserved: true,
        newRemovals: 0,
        activeAggregateCards: Object.keys(economy.instances).length,
        legacyCards: clean.tables["beta_fantasy.cards"].length,
        uncertainOwned: uncertainOwned.length,
        uncertainLegacyOwned: uncertainLegacy.length,
        uncertainLineupSelections: uncertainSelections.length,
        checkedLegacyReferences: checks,
        legacyOrphans: 0,
        acceptedRemovedCardsStillAbsent: acceptedManifest.cardIds.length,
        verifiedEligible: eligible.length,
        pools,
        mapped: bridge.approved.length,
        noRecordedAppearances: bridge.noAppearances.length,
        mappingConflicts: bridge.quarantined.length,
        reviewedPositionAliases: positionReviews.length,
        unchanged: [
          "accounts",
          "wallet",
          "ownership",
          "scarcity",
          "original removal archive",
          "historical statistics",
          "recorded entries",
          "lineup totals",
        ],
        activeAggregateOrphans: 0,
      },
      null,
      2,
    ),
  );
  console.log({
    eligible: eligible.length,
    mapped: bridge.approved.length,
    noAppearances: bridge.noAppearances.length,
    positionReviews: positionReviews.length,
    pools,
    additionalRemovals: 0,
    uncertainOwned: uncertainOwned.length,
  });
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
