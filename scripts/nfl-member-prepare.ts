import { writeFileSync, mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  refreshNflCatalogue,
  registerNflRound,
} from "../src/server/nfl-member-rounds";
import { downloadNflDataset, nflResource } from "../src/server/nflverse-bundle";
import { parseStatisticsCsv } from "../src/core/postgame-nflverse";
import { currentRulesets } from "../src/core/scoring-release";
import permit from "../config/nfl-postgame-permit.json";
async function main() {
  const sql = ownerDatabase();
  try {
    const season = 2026;
    await downloadNflDataset(sql, permit, "rosters", season);
    const [raw] =
      await sql`select raw_id from sports_feed.postgame_cache where resource=${nflResource("rosters", season)}`;
    const catalogue = await refreshNflCatalogue(
      sql,
      Number(raw.raw_id),
      season,
    );
    const source =
      "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error("Schedule unavailable");
    const text = await response.text();
    if (text.length > 10_000_000) throw Error("Schedule exceeds limit");
    const games = parseStatisticsCsv(text, {
      columns: [
        "game_id",
        "season",
        "game_type",
        "week",
        "gameday",
        "gametime",
        "home_team",
        "away_team",
      ],
      maxChars: 10_000_000,
      maxRows: 30000,
      maxColumns: 100,
    }).filter((r) => r.season === String(season) && r.game_type === "REG");
    const now = Date.now(),
      stamp = new Date().toISOString();
    const kickoff = (r: Record<string, string>) =>
      DateTime.fromISO(`${r.gameday}T${r.gametime}`, {
        zone: "America/New_York",
      })
        .toUTC()
        .toISO()!;
    const weeks = [...new Set(games.map((g) => Number(g.week)))].sort(
      (a, b) => a - b,
    );
    const week = weeks.find((w) =>
      games
        .filter((g) => Number(g.week) === w)
        .every((g) => Date.parse(kickoff(g)) > now + 3600000),
    );
    if (!week) throw Error("No verified future complete round");
    const selected = games.filter((g) => Number(g.week) === week);
    if (
      selected.length < 10 ||
      new Set(selected.flatMap((g) => [g.home_team, g.away_team])).size !==
        selected.length * 2
    )
      throw Error("Complete round mapping requires review");
    const players =
      await sql`select np.*,p.position,p.name from sports_feed.nfl_players np join beta_fantasy.players p on p.id=np.player_id where np.source_status='ACT'`;
    const id = `beta-real:nfl:${season}:${week}`;
    const mappings = selected.map((g) => {
      const mapped = players.filter((p) =>
        [g.home_team, g.away_team].includes(p.current_team),
      );
      if (mapped.length < 14) throw Error("Fixture roster incomplete");
      return {
        fixtureId: `${id}:${g.game_id}`,
        gameId: g.game_id,
        season,
        seasonType: "REG" as const,
        home: g.home_team,
        away: g.away_team,
        endedAt: null,
        completionEvidence:
          "https://github.com/nflverse/nflverse-data/releases/tag/pbp",
        playerIds: mapped.map((p) => p.player_id as string),
        players: mapped.map((p) => ({
          playerId: p.player_id as string,
          gsisId: p.provider_id as string,
          team: p.current_team as string,
          position: p.position as "QB" | "RB" | "WR" | "TE",
        })),
        scheduledAt: kickoff(g),
      };
    });
    const locksAt = mappings.map((m) => m.scheduledAt).sort()[0];
    const competition = await registerNflRound(
      sql,
      {
        id,
        sport: "nfl",
        label: `NFL Week ${week} · post-game beta`,
        locksAt,
        rules: currentRulesets.nfl,
        fixtures: mappings.map((m) => ({
          id: m.fixtureId,
          playerIds: m.playerIds,
          scheduledAt: m.scheduledAt,
        })),
      },
      mappings,
      {
        source,
        verifiedAt: stamp,
        completeRound: true,
        lockPolicy: "whole-round-before-first-kickoff",
        offsetSeconds: 0,
      },
    );
    // Current owner permission unchanged; friends control is not opened.
    await sql`update sports_feed.nfl_control set enabled=true where id`;
    const report = {
      at: stamp,
      catalogue,
      competition,
      week,
      fixtures: selected.length,
      locksAt,
      locksAtSydney: DateTime.fromISO(locksAt)
        .setZone("Australia/Sydney")
        .toISO(),
      admission: "unchanged-closed",
      commercialInventory: "unchanged",
      source,
    };
    mkdirSync("docs/qa/nfl-member", { recursive: true });
    writeFileSync(
      "docs/qa/nfl-member/preparation.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(report);
  } finally {
    await sql.end();
  }
}
void main();
