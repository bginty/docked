import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import catalogue from "../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
import { approvedAustralianLineup } from "../src/core/approved-australian-rules";
import { sevenIssues } from "../src/core/nfl-seven";

// Catalogue feasibility only: no card issuance, ownership inference or live eligibility claim.
const results = (["afl", "nrl"] as const).map((sport) => {
  const config = approvedAustralianLineup(sport);
  const players = catalogue.players.filter(
    (p) => p.sport === sport && p.status === "active",
  );
  const assigned = new Map<number, number>();
  function match(slot: number, visited: Set<number>): boolean {
    for (let i = 0; i < players.length; i++) {
      if (
        visited.has(i) ||
        !players[i].eligiblePositions.some((p) =>
          config.slots[slot].positions.includes(p),
        )
      )
        continue;
      visited.add(i);
      const prior = assigned.get(i);
      if (prior === undefined || match(prior, visited)) {
        assigned.set(i, slot);
        return true;
      }
    }
    return false;
  }
  config.slots.forEach((s, i) =>
    assert(match(i, new Set()), `${sport}: unmatched ${s.id}`),
  );
  const rows = [...assigned]
    .sort((a, b) => a[1] - b[1])
    .map(([i, slot]) => ({ player: players[i], slot: config.slots[slot] }));
  const cards = rows.map(({ player: p }, i) => ({
    id: `isolated-${i}`,
    player_id: p.id,
    sport,
    tier: "RARE",
    status: "active",
    listed: false,
    position: p.position,
    eligible_positions: p.eligiblePositions,
  }));
  const picks = rows.map(({ slot }, i) => ({
    slot: slot.id,
    card: cards[i].id,
  }));
  const rare = sevenIssues("SALARY_CAP", picks, cards, true, config);
  assert.deepEqual(rare.errors, []);
  const boundary = sevenIssues(
    "SALARY_CAP",
    picks,
    cards.map((c, i) => ({
      ...c,
      tier: i < (sport === "afl" ? 16 : 9) ? "RARE" : "ULTRA_RARE",
    })),
    true,
    config,
  );
  assert.deepEqual(boundary.errors, []);
  assert.equal(boundary.remaining, 0);
  return {
    sport,
    rosterPlayers: players.length,
    requiredSlots: config.slots.length,
    matched: rows.length,
    uniquePlayers: new Set(rows.map((r) => r.player.id)).size,
    allRareSalary: rare.total,
    exactBoundary: boundary.total,
    cap: config.salaryCap,
    slots: rows.map((r) => ({
      slot: r.slot.id,
      player: r.player.id,
      eligible: r.player.eligiblePositions,
    })),
    limitation:
      "Source-verified catalogue snapshot dated 2026-10-23. This does not establish any member owns the required cards, current roster freshness, or approval to issue them.",
  };
});
mkdirSync("docs/qa/member-collection-update", { recursive: true });
writeFileSync(
  "docs/qa/member-collection-update/positional-feasibility.json",
  JSON.stringify(results, null, 2),
);
console.log(
  results.map(({ sport, matched, cap }) => ({ sport, matched, cap })),
);
