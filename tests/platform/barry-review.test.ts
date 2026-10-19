import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialCardEconomy,
  allocateNine,
  sevenPlayerPackUpgrade,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import {
  probabilityLabel,
  collectionPositions,
  collectibleOnly,
  cardIdentity,
} from "../../src/core/card-display";
import { sevenIssues, nflSeven } from "../../src/core/nfl-seven";
import { boundedFetch } from "../../src/core/bounded-request";
const now = Date.now();
const players: EconomyPlayer[] = Array.from({ length: 40 }, (_, i) => ({
  id: `p${i}`,
  provider: "fixture",
  providerId: `p${i}`,
  sport: "nfl",
  assetKind: "player",
  name: `QA ${i}`,
  position: ["QB", "RB", "WR", "TE", "K"][i % 5],
  currentTeam: "QA",
  status: "active",
  observedAt: now,
  sourceRevision: "test",
  presentation: "docked",
}));
test("new gameplay packs exclude K without modifying old receipts, caps or prices", () => {
  const e = initialCardEconomy(players, now - 100);
  const old = allocateNine(
    e,
    "standard-nine-test-v1",
    "qa",
    "old",
    now,
    () => 0,
  );
  const frozen = JSON.stringify(old),
    instances = JSON.stringify(e.instances),
    defs = JSON.stringify(e.definitions);
  sevenPlayerPackUpgrade(e, now);
  assert.equal(JSON.stringify(e.packs.old), frozen);
  assert.equal(JSON.stringify(e.instances), instances);
  assert.equal(JSON.stringify(e.definitions), defs);
  for (const id of e.activeProductVersions!) {
    const p = e.products[id];
    assert.deepEqual(p.positions, ["QB", "RB", "WR", "TE"]);
    assert.equal(p.cards, 9);
    assert.equal(p.weights.ICON, 1);
    assert.deepEqual(
      p.weights,
      e.products[`${p.type.toLowerCase()}-nine-test-v1`].weights,
    );
    const pack = allocateNine(e, id, "qa", id, now, () => 0);
    assert.equal(pack.cards.length, 9);
    assert.ok(
      pack.cards.every(
        (id) => e.players[e.instances[id].playerId].position !== "K",
      ),
    );
  }
  assert.throws(
    () => allocateNine(e, "standard-nine-test-v1", "qa", "stale", now),
    /unavailable/,
  );
});
test("probability formatting never turns near-certainty into a guarantee", () => {
  assert.equal(probabilityLabel(1 - 0.15 ** 9), ">99.999%");
  assert.equal(probabilityLabel(1), "100%");
  assert.equal(probabilityLabel(0), "0%");
  assert.equal(probabilityLabel(0.000001), "<0.001%");
});
test("NFL filters and Core identity never imply football positions or limited Core supply", () => {
  assert.deepEqual(collectionPositions("nfl"), ["QB", "RB", "WR", "TE"]);
  assert.equal(collectibleOnly("K", "nfl"), true);
  assert.equal(collectibleOnly("RB", "nfl"), false);
  assert.match(
    cardIdentity({ id: "qa-core-1", tier: "CORE", serial: 1, max_supply: 0 }),
    /qa-core-1.*unlimited/,
  );
});
test("same-player duplicates remain invalid; salary replacement includes outgoing card; Open ignores cap", () => {
  const cards = nflSeven.slots.map((s, i) => ({
    id: `c${i}`,
    player_id: `p${i}`,
    tier: "CORE",
    position: s.positions[0],
    status: "active",
    listed: false,
  }));
  const picks = nflSeven.slots.map((s, i) => ({ slot: s.id, card: `c${i}` }));
  const high = cards.map((c) => ({ ...c, tier: "ICON" }));
  assert.equal(sevenIssues("OPEN", picks, high, true).errors.length, 0);
  assert.ok(sevenIssues("SALARY_CAP", picks, high, true).errors.length);
  high[0].tier = "CORE";
  assert.equal(sevenIssues("SALARY_CAP", picks, high, true).total, 5300000);
  cards[1].player_id = cards[0].player_id;
  assert.ok(
    sevenIssues("OPEN", picks, cards, true).errors.some((x) =>
      x.includes("one card"),
    ),
  );
});
test("hung read is bounded and never automatically repeats a request", async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async (_input, init) => {
    calls++;
    return new Promise((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(Error("aborted"))),
    );
  };
  try {
    await assert.rejects(() => boundedFetch("/qa", {}, 10), /timed out/);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
