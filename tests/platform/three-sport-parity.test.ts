import test from "node:test";
import assert from "node:assert/strict";
import { sportStandingRounds } from "../../src/core/sport-standings";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxLineupConfiguration } from "../../src/core/sport-sandbox-configuration";
import type { SandboxState } from "../../src/core/sport-sandbox";
import { prepareRosterBetaCatalogue } from "../../src/core/roster-beta-prepare";
import {
  initialCardEconomy,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import {
  paidPackOffers,
  paidPackWeights,
} from "../../src/core/paid-pack-catalogue";
import { prizeRewardLabel } from "../../src/core/prize-schedules";
import data from "../../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";

for (const cfg of [aflConfiguration, nrlConfiguration]) {
  test(`${cfg.label}: Rankings preserves locked slot/card identity and authoritative totals without inventing season results`, () => {
    const config = sandboxLineupConfiguration(cfg);
    const snapshot = cfg.slots.map((slot, i) => ({
      id: `card-${i}`,
      card_id: `card-${i}`,
      player_id: `player-${i}`,
      owner_id: "owner",
      slot: slot.id,
      name: `Isolated ${i}`,
      team: "Fixture",
      sport: cfg.id,
      tier: "CORE" as const,
      position: slot.positions[0],
      status: "active",
      listed: false,
    }));
    const state = {
      user_id: "owner",
      sport: cfg.id,
      server_time: "2099-01-01T00:00:00Z",
      team_name: "Saved name",
      cards: [],
      drafts: [],
      continuity: { established: {}, rollovers: [] },
      configurations: { [config.version]: config },
      competitions: [
        {
          id: "round",
          name: "Fixture",
          sport: cfg.id,
          season: "2099",
          round: 1,
          locks_at: "2099-01-02T00:00:00Z",
          rules: { mode: "OPEN", lineup_version: config.version },
        },
        {
          id: "nfl-round",
          name: "Wrong sport",
          sport: "nfl",
          season: "2099",
          round: 6,
          locks_at: "2099-01-02T00:00:00Z",
          rules: { mode: "OPEN", lineup_version: config.version },
        },
      ],
      entries: ["owner", "other"].map((user_id) => ({
        competition_id: "round",
        user_id,
        revision: 1,
        updated_at: "2099-01-01T00:00:00Z",
        snapshot,
      })),
    } as SandboxState;
    let rounds = sportStandingRounds(state);
    assert.equal(rounds.length, 1);
    assert.equal(rounds[0].rows[1].lineup, null);
    assert.equal(rounds[0].rows[0].centipoints, null);
    assert.equal(rounds[0].rows[0].name, "Saved name");
    state.server_time = "2099-01-03T00:00:00Z";
    state.scores = {
      round: {
        updatedAt: "2099-01-03T00:00:00Z",
        final: false,
        rows: [
          {
            user_id: "owner",
            name: "Saved name",
            points: 1234,
            rank: 2,
            played: 1,
            completed: 1,
            players: [
              {
                card_id: "card-0",
                slot: cfg.slots[0].id,
                points: 1234,
                status: "provisional",
                games: [
                  {
                    scheduledAt: "2099-01-02T01:00:00Z",
                    points: 1234,
                    status: "Scored",
                    revision: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    rounds = sportStandingRounds(state);
    assert.deepEqual(rounds[0].slots, config.slots);
    for (const row of rounds[0].rows)
      assert.deepEqual(
        row.lineup!.map((p) => [p.slot, p.cardId]),
        snapshot.map((p) => [p.slot, p.card_id]),
      );
    assert.equal(rounds[0].rows[0].centipoints, 1234);
    assert.equal(rounds[0].rows[0].rank, 2);
    assert.equal(rounds[0].rows[0].lineup![1].centipoints, null);
    assert.equal(rounds[0].fixtures!.length, 1);
    state.scores.round.rows[0].points = 1500;
    assert.equal(sportStandingRounds(state)[0].rows[0].centipoints, 1500);
  });
}

test("all 18 visible sport products preserve approved size, price and per-card pool", () => {
  const base = initialCardEconomy([], Date.now());
  const { products } = prepareRosterBetaCatalogue(
    base,
    data.players as EconomyPlayer[],
    Date.now(),
  );
  const visible = [
    ...paidPackOffers.map((p) => ({ ...p, sport: "nfl" })),
    ...products.filter((p) => ["afl", "nrl"].includes(p.sport)),
  ];
  assert.equal(visible.length, 18);
  for (const sport of ["nfl", "afl", "nrl"])
    for (const offer of paidPackOffers) {
      const product = visible.find(
        (p) =>
          p.sport === sport && p.type === offer.type && p.cards === offer.cards,
      )!;
      assert(product);
      assert.equal(product.priceCredits, offer.priceCredits);
      if (sport !== "nfl")
        assert.deepEqual(
          (product as (typeof products)[number]).weights,
          paidPackWeights[offer.type],
        );
    }
  assert.equal(
    prizeRewardLabel({
      from: 1,
      to: 1,
      type: "pack",
      amount: 2,
      description: "Configured reward",
      productVersion: "standard-3-afl-real-roster-beta-v1",
    }),
    "2 × Standard 3 Pack AFL",
  );
});
