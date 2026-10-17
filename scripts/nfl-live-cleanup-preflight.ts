// Offline preflight against a fresh, checksum-verified live export. No network writes.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  cleanTestEconomy,
  type RemovalApproval,
} from "../src/core/nfl-test-cleanup";
import { digest } from "../src/core/scoring-engine";
import type { CreditsState } from "../src/core/credits-sandbox";

async function main() {
  const dir = process.argv[2] ?? "private-data/nfl-live-recovery-20261017";
  const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
  const receipt = await read(`${dir}/receipt.json`);
  const raw = await readFile(`${dir}/snapshot.json`);
  assert.equal(createHash("sha256").update(raw).digest("hex"), receipt.sha256);
  const drill = await read(`${dir}/restore-drill.json`);
  assert.equal(drill.passed, true);
  assert.equal(drill.snapshotSha256, receipt.sha256);
  const tables = JSON.parse(raw.toString());
  const before: CreditsState = tables["credits_sandbox.state"][0].document;
  const accepted = await read("docs/qa/nfl-roster-audit/removal-manifest.json");
  const oldRaw = await readFile(accepted.snapshot.file);
  assert.equal(
    createHash("sha256").update(oldRaw).digest("hex"),
    accepted.snapshot.sha256,
  );
  const previous: CreditsState = JSON.parse(oldRaw.toString()).tables[
    "credits_sandbox.state"
  ][0].document;
  const approved: RemovalApproval[] = accepted.approved.map(
    (p: RemovalApproval) => {
      const identity = previous.economy!.players[p.playerId];
      assert.ok(identity);
      const candidates = Object.values(before.economy!.players).filter(
        (live) =>
          live.provider === identity.provider &&
          live.providerId === identity.providerId &&
          live.sport === identity.sport &&
          live.assetKind === identity.assetKind,
      );
      assert.equal(
        candidates.length,
        1,
        `Identity no longer unique: ${p.name}`,
      );
      const player = candidates[0];
      const cards = Object.values(before.economy!.instances)
        .filter((c) => c.playerId === player.id)
        .map((c) => c.id)
        .sort();
      // Scope may shrink if already removed, but never silently expands.
      assert.ok(
        cards.length <= p.cards.length,
        `New cards outside approved scope: ${p.name}`,
      );
      return { ...p, playerId: player.id, cards };
    },
  );
  const ids = new Set(approved.flatMap((p) => p.cards));
  const dependencies: Record<string, number> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (table.startsWith("credits_sandbox.")) continue; // immutable issuance is retained
    const matched = (rows as unknown[]).filter((row) =>
      [...ids].some((id) => JSON.stringify(row).includes(id)),
    );
    dependencies[table] = matched.length;
    assert.equal(
      matched.length,
      0,
      `Domain-specific transition required: ${table}`,
    );
  }
  const result = cleanTestEconomy(before, approved);
  assert.equal(result.cardIds.length, 8);
  for (const key of Object.keys(before) as (keyof CreditsState)[]) {
    if (
      [
        "economy",
        "cards",
        "commerce",
        "listings",
        "swaps",
        "privateCardOffers",
      ].includes(key)
    )
      continue;
    assert.equal(
      digest(result.state[key]),
      digest(before[key]),
      `Unrelated state changed: ${key}`,
    );
  }
  assert.equal(
    digest(result.state.economy!.definitions),
    digest(before.economy!.definitions),
  );
  assert.equal(
    digest(result.state.economy!.packs),
    digest(before.economy!.packs),
  );
  for (const [id, card] of Object.entries(before.economy!.instances)) {
    if (ids.has(id))
      assert.equal(
        digest(result.state.economy!.retiredTestInstances![id]),
        digest(card),
      );
    else {
      assert.equal(digest(result.state.economy!.instances[id]), digest(card));
      assert.equal(
        digest(result.state.commerce.cards[id]),
        digest(before.commerce.cards[id]),
      );
      assert.equal(digest(result.state.cards[id]), digest(before.cards[id]));
    }
  }
  const again = cleanTestEconomy(result.state, approved);
  assert.equal(again.cardIds.length, 0);
  assert.equal(digest(again.state), digest(result.state));
  const manifest = {
    scope: "offline-current-live-preflight-only",
    at: new Date().toISOString(),
    snapshotSha256: receipt.sha256,
    revision: tables["credits_sandbox.state"][0].revision,
    approved,
    cardIds: result.cardIds,
    relationalDependencies: dependencies,
    beforeStateHash: digest(before),
    afterStateHash: digest(result.state),
    archive: result.archive,
  };
  await writeFile(
    `${dir}/cleanup-preflight.json`,
    JSON.stringify(manifest, null, 2),
  );
  const report = {
    scope: manifest.scope,
    snapshotSha256: receipt.sha256,
    players: approved.map((p) => ({ name: p.name, cards: p.cards.length })),
    cards: result.cardIds.length,
    dependentRecords: Object.keys(result.archive).filter(
      (k) => !k.startsWith("card:"),
    ).length,
    relationalDependencies: 0,
    walletAccountsEligibleCardsAndScarcityUnchanged: true,
    idempotent: true,
    liveRemoved: 0,
  };
  await writeFile(
    "docs/qa/nfl-batch/live-cleanup-preflight.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
