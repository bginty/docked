import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOfficialRoster,
  matchKnownRoster,
  officialUrl,
} from "../../src/core/official-roster-refresh";
import {
  nflversePostgame,
  nflverseRequiredColumns,
} from "../../src/core/postgame-nflverse";
import { scorePlayer, rulesets } from "../../src/core/scoring-v1";
import { socialAttachments } from "../../src/core/social-attachment";
test("complete official pages only; ambiguous names and unsupported positions cannot refresh identities", () => {
  const rows = Array.from(
    { length: 53 },
    (_, i) =>
      `<tr><td><a href='/team/players-roster/player-${i}/'>Player ${i}</a></td><td>${i}</td><td>${i === 0 ? "QB" : "WR"}</td></tr>`,
  ).join("");
  const html = `<h3>Active</h3><table><thead><th>Player</th><th>No.</th><th>Pos</th></thead><tbody>${rows}</tbody></table>`;
  const parsed = parseOfficialRoster(html, officialUrl("PHI")!);
  assert.equal(parsed.length, 53);
  assert.equal(matchKnownRoster(parsed, "Player 0", "QB")?.status, "active");
  assert.equal(matchKnownRoster(parsed, "Player 0", "WR"), null);
  assert.equal(
    matchKnownRoster([...parsed, parsed[0]], "Player 0", "QB"),
    null,
  );
  assert.throws(
    () => parseOfficialRoster("<h3>Active</h3>", officialUrl("PHI")!),
    /incomplete/,
  );
});
test("verified Week 6 Travis Hunter CB feed record scores in the frozen WR role only with WR/CB evidence", () => {
  // Retained source raw 39, checked 2026-10-21T00:05:02Z. Actual source values;
  // companion categories are verified zero and require no invented play data.
  const row: Record<string, string> = {
    player_id: "00-0040718",
    player_display_name: "Travis Hunter",
    position: "CB",
    team: "JAX",
    opponent_team: "HOU",
    season: "2026",
    week: "6",
    season_type: "REG",
    game_id: "2026_06_HOU_JAX",
    passing_yards: "0",
    passing_tds: "0",
    passing_interceptions: "0",
    rushing_yards: "0",
    rushing_tds: "0",
    receptions: "4",
    receiving_yards: "59",
    receiving_tds: "1",
    passing_2pt_conversions: "0",
    rushing_2pt_conversions: "0",
    receiving_2pt_conversions: "0",
    special_teams_tds: "0",
    fumble_recovery_tds: "0",
    fumbles_lost_total: "0",
  };
  const csv =
    nflverseRequiredColumns.join(",") +
    "\n" +
    nflverseRequiredColumns.map((k) => row[k]).join(",");
  const mapping = {
    fixtureId: "isolated-hou-jax",
    gameId: row.game_id,
    season: 2026,
    seasonType: "REG" as const,
    home: "JAX",
    away: "HOU",
    endedAt: null,
    completionObservedAt: "2026-10-20T06:05:11.711Z",
    completionEvidence:
      "https://github.com/nflverse/nflverse-data/releases/tag/pbp",
    players: [
      {
        playerId: "2fb8b49f-7c65-42c1-9d7e-8121dac413b8",
        gsisId: row.player_id,
        team: "JAX",
        position: "WR" as const,
      },
    ],
  };
  const parse = (e: Record<string, string>) =>
    nflversePostgame(
      csv,
      mapping,
      1,
      "2026-10-21T00:05:02Z",
      undefined,
      undefined,
      e,
    );
  assert.equal(parse({}).snapshot.players[0].stats, null);
  assert.equal(
    parse({ [row.player_id]: "WR" }).snapshot.players[0].stats,
    null,
  );
  const result = parse({ [row.player_id]: "WR/CB" });
  assert.deepEqual(result.issues, []);
  assert.equal(
    scorePlayer(rulesets.nfl, "WR", result.snapshot.players[0].stats)
      .centipoints,
    1390,
  );
});
test("historical cross-sport social attachment becomes unavailable, never unrelated artwork", () => {
  const card = {
    id: "card",
    player_id: "player",
    edition_id: "edition",
    name: "Arlo Vale",
    position: "GK",
    tier: "CORE",
    sport: "football",
    team: "London",
    colour: "#123456",
    shirt: 1,
    status: "active",
    season: "2026",
    kind: "regular",
    tradeable: false,
  };
  const result = socialAttachments([card], { sport: "nfl" });
  assert.equal(result.cards.length, 0);
  assert.equal(result.unavailable, 1);
});
