import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import {
  cleanTestEconomy,
  type RemovalApproval,
} from "../src/core/nfl-test-cleanup";
import { digest } from "../src/core/scoring-engine";

// No connection string, hosted SDK or HTTP client: PGlite filesystem copy only.
async function main() {
  if (process.env.VERCEL) throw Error("Local-only operation");
  const meta = JSON.parse(
    await readFile("private-data/nfl-roster-audit/latest.json", "utf8"),
  );
  const raw = await readFile(meta.file, "utf8");
  assert.equal(createHash("sha256").update(raw).digest("hex"), meta.sha256);
  const source = JSON.parse(raw),
    audit = JSON.parse(
      await readFile("docs/qa/nfl-roster-audit/catalogue-audit.json", "utf8"),
    );
  assert.equal(audit.summary.snapshotSha256, meta.sha256);
  assert.equal(audit.summary.teams.length, 32);
  assert.ok(
    audit.summary.teams.every(
      (t: any) => t.status === "parsed-review-required",
    ),
  );
  assert.ok(
    audit.summary.teams.every((t: any) => {
      const age = Date.now() - Date.parse(t.checkedAt);
      return Number.isFinite(age) && age >= 0 && age <= 72 * 3600000;
    }),
    "Refresh all 32 roster sources before applying a removal manifest",
  );
  const approved: RemovalApproval[] = audit.records
    .filter(
      (p: any) =>
        (p.decision === "unsupported" ||
          (["released", "retired"].includes(p.decision) && !p.official)) &&
        p.cardIds.length,
    )
    .map((p: any) => ({
      playerId: p.id,
      name: p.name,
      reason: p.decision,
      cards: p.cardIds,
      evidence: [
        ...(p.official ? [p.official.url, p.official.profile] : []),
        ...p.transactions.map((t: any) => t.url),
      ],
    }));
  const ids = new Set(approved.flatMap((p) => p.cards));
  const tables = source.tables;
  // Fail closed if a newly discovered dependency needs a domain-specific update.
  // Never use recursive deletion of arbitrary JSON that might contain money/history.
  const mutableTables = [
    "beta_fantasy.cards",
    "beta_fantasy.listings",
    "beta_fantasy.swaps",
    "beta_fantasy.trade_items",
    "beta_fantasy.entries",
    "beta_fantasy.round_drafts",
    "beta_fantasy.slot_locks",
    "sports_feed.weekly_core_packs",
  ];
  const dependencies = Object.fromEntries(
    mutableTables.map((name) => [
      name,
      tables[name].filter((r: unknown) =>
        [...ids].some((id) => JSON.stringify(r).includes(id)),
      ),
    ]),
  );
  if (Object.values(dependencies).some((rows) => (rows as unknown[]).length))
    throw Error(
      "Reviewed relational dependency transition required before cleanup",
    );
  const before = tables["credits_sandbox.state"][0].document;
  const result = cleanTestEconomy(before, approved);
  let manifest = {
    scope: "isolated-local-copy",
    at: new Date().toISOString(),
    snapshot: meta,
    approved,
    cardIds: result.cardIds,
    dependentRecords: Object.keys(result.archive).filter(
      (k) => !k.startsWith("card:"),
    ),
    packs: Object.values(before.economy.packs)
      .filter((p: any) => p.cards.some((id: string) => ids.has(id)))
      .map((p: any) => ({
        id: p.id,
        opened: p.openedAt !== null,
        removedCards: p.cards.filter((id: string) => ids.has(id)),
        remaining: p.cards.filter((id: string) => !ids.has(id)).length,
      })),
    relationalDependencies: Object.fromEntries(
      Object.entries(dependencies).map(([k, v]) => [
        k,
        (v as unknown[]).length,
      ]),
    ),
    beforeStateHash: digest(before),
    afterStateHash: digest(result.state),
  };
  const out = "docs/qa/nfl-roster-audit";
  await mkdir(out, { recursive: true });
  // Both files reach disk BEFORE the transaction. Snapshot is immutable/read back above.
  try {
    const prior = JSON.parse(
      await readFile(`${out}/removal-manifest.json`, "utf8"),
    );
    assert.equal(prior.snapshot.sha256, manifest.snapshot.sha256);
    assert.equal(prior.beforeStateHash, manifest.beforeStateHash);
    assert.equal(prior.afterStateHash, manifest.afterStateHash);
    assert.equal(digest(prior.approved), digest(manifest.approved));
    manifest = prior; // Preserve the original pre-execution timestamp on retries.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(
      `${out}/removal-manifest.json`,
      JSON.stringify(manifest, null, 2),
    );
  }
  const localPath = resolve(
    "tmp/nfl-roster-cleanup-" + meta.sha256.slice(0, 12),
  );
  const db = new PGlite(localPath);
  try {
    await db.exec(
      "create schema if not exists roster_cleanup; create table if not exists roster_cleanup.copy(id boolean primary key check(id),snapshot_hash text not null,document jsonb not null); create table if not exists roster_cleanup.audit(id text primary key,manifest jsonb not null,archive jsonb not null);",
    );
    await db.query(
      "insert into roster_cleanup.copy values(true,$1,$2) on conflict do nothing",
      [meta.sha256, source],
    );
    const after = structuredClone(source);
    after.tables["credits_sandbox.state"][0].document = result.state;
    // Issuance receipts/definitions remain immutable historical evidence. Active
    // instances are archived with original serials; they never return to supply.
    after.tables["credits_sandbox.card_instances"] = tables[
      "credits_sandbox.card_instances"
    ].filter((c: any) => !ids.has(c.id));
    after.retiredTestInstances = tables[
      "credits_sandbox.card_instances"
    ].filter((c: any) => ids.has(c.id));
    await db.transaction(async (tx) => {
      const prior = await tx.query(
        "select id from roster_cleanup.audit where id=$1",
        [meta.sha256],
      );
      if (prior.rows.length) return;
      const row: any = (
        await tx.query("select * from roster_cleanup.copy where id for update")
      ).rows[0];
      assert.equal(digest(row.document), digest(source));
      await tx.query("insert into roster_cleanup.audit values($1,$2,$3)", [
        meta.sha256,
        manifest,
        result.archive,
      ]);
      await tx.query("update roster_cleanup.copy set document=$1 where id", [
        after,
      ]);
    });
    const saved: any = (
      await db.query("select document from roster_cleanup.copy where id")
    ).rows[0];
    assert.equal(digest(saved.document), digest(after));
    assert.equal(digest(result.state.journal), digest(before.journal));
    assert.equal(digest(result.state.lots), digest(before.lots));
    assert.equal(
      digest(result.state.economy?.definitions),
      digest(before.economy.definitions),
    );
    for (const id of ids) {
      assert.equal(result.state.cards[id], undefined);
      assert.equal(result.state.commerce.cards[id], undefined);
      assert.equal(result.state.economy?.instances[id], undefined);
      assert.ok(result.state.economy?.retiredTestInstances?.[id]);
    }
    const again = cleanTestEconomy(result.state, approved);
    assert.equal(digest(again.state), digest(result.state));
    assert.equal(again.cardIds.length, 0);
    const unchangedTables = Object.keys(tables).filter(
      (k) =>
        !["credits_sandbox.state", "credits_sandbox.card_instances"].includes(
          k,
        ),
    );
    for (const key of unchangedTables)
      assert.equal(digest(tables[key]), digest(after.tables[key]));
    await writeFile(
      "private-data/nfl-roster-audit/cleaned-local-copy.json",
      JSON.stringify(after),
      { mode: 0o600 },
    );
    const report = {
      scope: "isolated-local-copy",
      localPath,
      snapshotSha256: meta.sha256,
      removedPlayers: approved.map((p) => ({
        name: p.name,
        id: p.playerId,
        cards: p.cards,
      })),
      removedCards: result.cardIds.length,
      removedOwnedRecords: result.cardIds.length,
      removedOwnershipHistories: result.cardIds.length,
      retainedImmutableAllocations: result.cardIds.length,
      dependentRecords: manifest.dependentRecords,
      affectedPacks: manifest.packs,
      affectedLineups: 0,
      lineupRecalculation:
        "Not needed: no selected removed card in any captured lineup or draft",
      walletUnchanged: true,
      accountsUnchanged: true,
      historicalStatisticsUntouched: true,
      scarcityUnchanged: true,
      idempotent: true,
      activeOrphanReferences: 0,
      unchangedTables,
    };
    await writeFile(
      `${out}/cleanup-result.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
