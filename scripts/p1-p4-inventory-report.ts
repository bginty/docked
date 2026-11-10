/** Offline report from the read-only census; never opens a database or imports. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { reconcileLifetimePool } from "../src/core/lifetime-reconciliation";
const dir = "docs/qa/v31-p1-p4-20261110";
const source = readFileSync(
  "private-data/commercial-pool-20261106-v2/candidate.private.json",
);
const candidate = JSON.parse(source.toString());
const census = JSON.parse(
  readFileSync(`${dir}/issued-reconciliation.json`, "utf8"),
);
const reconciled = reconcileLifetimePool(candidate.rows, census.rows);
const rows = reconciled.rows.map((r) => ({
  sport: r.sport,
  name: r.snapshot.name,
  player_id: r.player_id,
  provider: r.snapshot.provider,
  provider_id: r.snapshot.providerId,
  rarity: r.rarity,
  issued: r.legacy_issued,
  available: 0,
  reserved: 0,
  remainingLifetimeCapacity: r.lifetime_cap - r.legacy_issued,
  cap: r.lifetime_cap,
  sourceApproved: false,
}));
const unmatched = reconciled.unmatched.map((r) => ({
  ...r,
  available: 0,
  reserved: 0,
  remainingLifetimeCapacity:
    (
      {
        RARE: 5000,
        ELITE: 2500,
        ULTRA_RARE: 400,
        LEGENDARY: 50,
        ICON: 1,
      } as Record<string, number>
    )[r.rarity] - r.issued,
}));
const summary = ["nfl", "afl", "nrl"].map((sport) => ({
  sport,
  candidatePlayers: rows.filter((r) => r.sport === sport && r.rarity === "ICON")
    .length,
  rarities: ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"].map(
    (rarity) => ({
      rarity,
      issued: census.rows
        .filter(
          (r: { sport: string; rarity: string }) =>
            r.sport === sport && r.rarity === rarity,
        )
        .reduce((n: number, r: { issued: number }) => n + r.issued, 0),
      candidateRemaining: rows
        .filter((r) => r.sport === sport && r.rarity === rarity)
        .reduce((n, r) => n + r.remainingLifetimeCapacity, 0),
      available: 0,
      reserved: 0,
    }),
  ),
  core: "Unlimited virtual gameplay eligibility; not scarce commercial stock",
}));
writeFileSync(
  `${dir}/inventory-plan.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      censusAt: census.observedAt,
      candidateCapturedAt: candidate.capturedAt,
      candidateSha256: createHash("sha256").update(source).digest("hex"),
      summary,
      rows,
      unmatched,
      matchedLifetimeIssuance: reconciled.legacyIssued,
      proposedDigest: reconciled.digest,
      importReady: false,
      identityReconciliationComplete: reconciled.importReady,
      note: "Theoretical capacity is not available stock. No source approval, reservations, definitions or cards were imported. Existing synthetic gameplay fixtures remain separate. Hidden NBA untouched. Prior zero-baseline plan is superseded.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    summary,
    matched: reconciled.legacyIssued,
    unmatched: unmatched.length,
    identityReconciliationComplete: reconciled.importReady,
  }),
);
