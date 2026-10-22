import test from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import catalogue from "../../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
import { refreshEconomyCatalogue } from "../../src/server/economy-catalogue";
import { prepareRosterBetaCatalogue } from "../../src/core/roster-beta-prepare";
import {
  memberTestView,
  memberTestSummary,
} from "../../src/core/member-test-wallet";
import { allocateNine, type EconomyPlayer } from "../../src/core/card-economy";
import { packFixture, packMember } from "../fixtures/pack-economy";
import { executeCredits } from "../../src/core/credits-sandbox";

function fixture() {
  const state = packFixture();
  const now = Date.now();
  state.economy = prepareRosterBetaCatalogue(
    state.economy!,
    catalogue.players as EconomyPlayer[],
    now,
  ).economy;
  state.economy.nbaTestAllocation!.enabled = true;
  state.economy.fixtureTestAllocation = {
    afl: { enabled: true, scope: "isolated-fixtures-v1" },
    nrl: { enabled: true, scope: "isolated-fixtures-v1" },
  };
  return { state, now };
}
const observations = (now: number) =>
  Array.from({ length: 24 }, (_, i) => ({
    id: `local-${i}`,
    team: "BUF",
    position: ["QB", "RB", "WR", "TE"][i % 4],
    status: "ACT",
    checked_at: new Date(now),
    raw_id: "current-nfl-revision",
    verified_jersey_number: 12,
  }));

test("request-time NFL refresh preserves all registered real roster identities and leaves all six beta packs purchasable", async () => {
  const { state, now } = fixture();
  const before = structuredClone(state);
  const sql = (async () => observations(now)) as unknown as Sql;
  await refreshEconomyCatalogue(sql, state);
  const real = Object.values(state.economy!.players).filter(
    (p) => p.inventoryClass === "real-roster-beta-v1",
  );
  assert.equal(real.length, 1399);
  for (const p of real) assert.deepEqual(p, before.economy!.players[p.id]);
  assert.equal(
    state.economy!.players["local-0"].sourceRevision,
    "current-nfl-revision",
  );
  assert.equal(state.economy!.players["local-0"].verifiedJerseyNumber, 12);
  assert.deepEqual(state.lots, before.lots);
  assert.deepEqual(state.journal, before.journal);
  const view = memberTestView(state, packMember.id, [], false, now, [], {
    catalogue: false,
  });
  const products = view.products.filter(
    (p) => "inventoryScope" in p && p.inventoryScope === "real-roster-beta-v1",
  );
  assert.equal(products.length, 6);
  for (const product of products) {
    assert(product.available, product.id);
    assert(product.eligiblePlayers > 300);
    const pack = allocateNine(
      state.economy!,
      product.id,
      packMember.id,
      `regression-${product.id}`,
      now,
      () => 0,
    );
    assert.equal(pack.cards.length, 9);
    assert.equal(
      new Set(pack.cards.map((id) => state.economy!.instances[id].playerId))
        .size,
      9,
    );
  }
});

test("missing NFL observations and invalid beta provenance still fail closed without renewing dated snapshots", async () => {
  const { state } = fixture();
  const player = Object.values(state.economy!.players).find(
    (p) => p.inventoryClass === "real-roster-beta-v1",
  )!;
  player.rosterBeta!.sourceHash = "invalid";
  await refreshEconomyCatalogue((async () => []) as unknown as Sql, state);
  assert.equal(player.status, "unknown");
  assert.equal(state.economy!.players["local-0"].status, "unknown");
});

test("compact shop and shared balance projections preserve recorded purchases, balances and history without catalogue or owner data", () => {
  const { state, now } = fixture();
  const product = Object.values(state.economy!.products).find(
    (p) => p.inventoryScope === "real-roster-beta-v1",
  )!;
  const purchase = executeCredits(
    state,
    packMember,
    "loading-purchase",
    {
      kind: "buy-pack",
      product: product.id,
      configuration: product.version,
      policy: state.policy.version,
      expectedPrice: product.priceCredits,
      confirmed: true,
    },
    now,
  );
  const replay = executeCredits(
    purchase.state,
    packMember,
    "loading-purchase",
    {
      kind: "buy-pack",
      product: product.id,
      configuration: product.version,
      policy: state.policy.version,
      expectedPrice: product.priceCredits,
      confirmed: true,
    },
    now + 1,
  );
  assert.deepEqual(replay.state, purchase.state);
  const full = memberTestView(purchase.state, packMember.id, [], false, now);
  const compact = memberTestView(
    purchase.state,
    packMember.id,
    [],
    false,
    now,
    [],
    { catalogue: false },
  );
  assert.deepEqual(compact, { ...full, pool: [] });
  assert.equal(compact.ownerReport, null);
  assert.equal(compact.ownerEconomy, null);
  const summary = memberTestSummary(purchase.state, packMember.id, now);
  assert.deepEqual(summary.wallet, full.wallet);
  assert.deepEqual(summary.portfolio, full.portfolio);
  assert.deepEqual(
    summary.packs,
    full.packs.map((p) => ({ status: p.status })),
  );
  assert.deepEqual(
    summary.swaps,
    full.swaps.map((s) => ({ status: s.status })),
  );
  assert.equal(summary.packs.length, 1);
  assert(Buffer.byteLength(JSON.stringify(summary)) < 10000);
  assert(Buffer.byteLength(JSON.stringify(compact)) < 50000);
});
