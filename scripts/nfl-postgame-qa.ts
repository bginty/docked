import type { Sql } from "postgres";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { digest, type ScoringState } from "../src/core/scoring-engine";
import { rulesets, validateLineup } from "../src/core/scoring-v1";
import type { PostgameMapping } from "../src/core/postgame-nflverse";

/** Explicit retrospective SOFTWARE ACCEPTANCE, never a prospective competition.
 * No real cards are minted, referenced, transferred or awarded. No backdated audit. */
export async function createNflHistoricalQa(
  sql: Sql,
  rows: Record<string, string>[],
  id = "beta-real:qa:nfl-atl-pit-2026",
) {
  if (!id.startsWith("beta-real:qa:")) throw Error("QA namespace only");
  const wanted = [
    "00-0023459",
    "00-0037228",
    "00-0038542",
    "00-0035640",
    "00-0037238",
    "00-0036894",
    "00-0036970",
  ];
  const selected = wanted.map((p) => {
    const row = rows.find(
      (r) => r.game_id === "2026_01_ATL_PIT" && r.player_id === p,
    );
    if (!row) throw Error("Actual QA player missing");
    return row;
  });
  const at = new Date().toISOString(),
    rules = structuredClone(rulesets.nfl),
    fixtureId = id + ":game";
  const cards = selected.map((r) => ({
    cardId: `qa-only:${r.player_id}`,
    playerId: `gsis:${r.player_id}`,
    position: r.position,
  }));
  validateLineup(rules, cards);
  const state: ScoringState = {
    schemaVersion: 1,
    scope: "authorised-free-beta",
    period: {
      id,
      sport: "nfl",
      label: "Atlanta at Pittsburgh · 13 September 2026",
      locksAt: "2026-09-13T17:00:00.000Z",
      rules,
      fixtures: [
        {
          id: fixtureId,
          playerIds: cards.map((c) => c.playerId),
          scheduledAt: "2026-09-13T17:00:00.000Z",
        },
      ],
    },
    entries: [],
    sources: [],
    audits: [
      {
        sequence: 1,
        actor: "postgame-qa-operator",
        action: "historical-acceptance-created",
        at,
        reason:
          "Retrospective test lineup, no member assets, no competition awards",
        payloadHash: digest(cards),
      },
    ],
    finalisedAt: null,
    lineupsLockedAt: null,
  };
  const store = new SportsFeedStore(sql);
  if (!(await sql`select id from sports_feed.streams where id=${id}`).length) {
    await store.create(state);
    await sql`update sports_feed.streams set purpose='historical-acceptance',display_metadata=${sql.json({ source: "nflverse", players: Object.fromEntries(selected.map((r) => [`gsis:${r.player_id}`, r.player_display_name])) })} where id=${id}`;
  }
  await store.change(id, (s) => {
    if (s.entries.length) return s;
    s.entries = [
      {
        member: "historical-qa-only",
        name: "Acceptance lineup · no account awards",
        cards,
        lockedAt: at,
        rulesHash: digest(rules),
      },
    ];
    s.lineupsLockedAt = at;
    s.audits.push({
      sequence: s.audits.length + 1,
      actor: "postgame-qa-operator",
      action: "historical-test-lineup",
      at,
      reason:
        "Created AFTER game for calculation acceptance only; not a member entry",
      payloadHash: digest(cards),
    });
    return s;
  });
  const mapping: PostgameMapping = {
    fixtureId,
    gameId: "2026_01_ATL_PIT",
    season: 2026,
    seasonType: "REG",
    home: "PIT",
    away: "ATL",
    endedAt: null,
    completionEvidence:
      "https://github.com/nflverse/nflverse-data/releases/tag/pbp",
    players: selected.map((r) => ({
      playerId: `gsis:${r.player_id}`,
      gsisId: r.player_id,
      team: r.team,
      position: r.position as "QB" | "RB" | "WR" | "TE",
    })),
  };
  return { id, mapping };
}
