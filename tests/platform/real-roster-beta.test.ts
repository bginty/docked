import test from "node:test";
import assert from "node:assert/strict";
import data from "../../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
import { isRosterBetaPlayer } from "../../src/core/roster-beta";
import {
  initialCardEconomy,
  allocateNine,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import {
  prepareRosterBetaCatalogue,
  rosterBetaCoreCards,
} from "../../src/core/roster-beta-prepare";
import { sandboxLineupConfiguration } from "../../src/core/sport-sandbox-configuration";
import {
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { autoSelect } from "../../src/core/lineup-auto-select";
import { sevenIssues } from "../../src/core/nfl-seven";
import { teamColours } from "../../src/core/sport-team-colours";
const players = data.players as EconomyPlayer[];
test("source records have unique stable real identities, supported positions and attributable evidence", () => {
  assert.equal(players.length, 1399);
  assert.equal(new Set(players.map((p) => p.id)).size, players.length);
  assert.equal(
    new Set(players.map((p) => p.fixturePlayerId)).size,
    players.length,
  );
  for (const p of players) {
    assert(isRosterBetaPlayer(p));
    assert(!/^(Test|QA) /.test(p.name));
    assert.equal(p.synthetic, false);
    assert.equal(p.rosterBeta!.permanentIssuanceEligible, false);
    assert.equal(p.verifiedJerseyNumber, null);
    assert(p.observedAt <= Date.now());
  }
  for (const [sport, n, teams] of [
    ["basketball", 517, 30],
    ["afl", 545, 18],
    ["nrl", 337, 17],
  ] as const) {
    const list = players.filter((p) => p.sport === sport);
    assert.equal(list.length, n);
    assert.equal(new Set(list.map((p) => p.currentTeam)).size, teams);
  }
  for (const player of players)
    assert(
      teamColours(player.sport, player.currentTeam),
      `Missing original jersey palette: ${player.currentTeam}`,
    );
  assert.equal(players.find(p => p.name.startsWith("Ben Saraf"))?.name, "Ben Saraf");
  assert.equal(players.find(p => p.name.startsWith("Danny Wolf"))?.name, "Danny Wolf");
  assert.equal(players.find(p => p.name.startsWith("Emanuel Sharp"))?.name, "Emanuel Sharp");
  const altered = structuredClone(players[0]);
  altered.synthetic = true;
  assert(!isRosterBetaPlayer(altered));
  altered.synthetic = false;
  altered.rosterBeta!.permanentIssuanceEligible = true as false;
  assert(!isRosterBetaPlayer(altered));
});
for (const cfg of [nbaWeeklyConfiguration, aflConfiguration, nrlConfiguration])
  test(`${cfg.label}: actual roster cards form valid capped/open teams and nine-card packs without touching NFL`, () => {
    const now = Date.now();
    const base = initialCardEconomy([], now);
    const old = structuredClone(base);
    const { economy, products } = prepareRosterBetaCatalogue(
      base,
      players,
      now,
    );
    assert.deepEqual(base, old);
    if (cfg.id === "basketball") economy.nbaTestAllocation!.enabled = true;
    else economy.fixtureTestAllocation ??= {};
    if (cfg.id === "afl" || cfg.id === "nrl")
      economy.fixtureTestAllocation![cfg.id] = {
        enabled: true,
        scope: "isolated-fixtures-v1",
      };
    const cards = rosterBetaCoreCards(
      "00000000-0000-4000-a000-000000000001",
      players.filter((p) => p.sport === cfg.id),
    );
    const config = sandboxLineupConfiguration(cfg);
    for (const mode of ["SALARY_CAP", "OPEN"] as const) {
      const result = autoSelect(
        cards.map((c) => ({ ...c, value: null })),
        mode,
        [],
        config,
      );
      assert.equal(result.picks.length, cfg.slots.length);
      assert.deepEqual(
        sevenIssues(mode, result.picks, cards, true, config).errors,
        [],
      );
    }
    for (const p of products.filter((p) => p.sport === cfg.id)) {
      const pack = allocateNine(
        economy,
        p.id,
        "isolated-owner",
        "isolated-" + p.id,
        now,
        () => 0,
      );
      assert.equal(pack.cards.length, 9);
      const ids = pack.cards.map((id) => economy.instances[id].playerId);
      assert.equal(new Set(ids).size, 9);
      assert(ids.every((id) => isRosterBetaPlayer(economy.players[id])));
      assert(pack.cards.every((id) => economy.instances[id].rarity !== "CORE"));
      assert([700, 5000].includes(p.priceCredits));
    }
    for (const [id, p] of Object.entries(old.products))
      assert.deepEqual(economy.products[id], p);
  });
