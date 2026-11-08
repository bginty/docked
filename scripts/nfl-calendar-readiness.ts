// Operator-only calendar preparation. Default is READ ONLY. No publication path.
import { DateTime } from "luxon";
import { mkdirSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { parseStatisticsCsv } from "../src/core/postgame-nflverse";
import {
  planNflCalendar,
  nflCalendarStream,
} from "../src/core/nfl-round-calendar";
import { registerNflRound } from "../src/server/nfl-member-rounds";
import { nflSeven, sevenRules } from "../src/core/nfl-seven";
import permit from "../config/nfl-postgame-permit.json";

async function main() {
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  if (!process.argv.includes("--season"))
    throw Error("Explicit --season required");
  const season = Number(value("--season"));
  if (
    !Number.isInteger(season) ||
    season < 2020 ||
    season > new Date().getUTCFullYear() + 1
  )
    throw Error("Invalid calendar season");
  const source =
    "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";
  if (
    !permit.enabled ||
    permit.scope !== "isolated-free-beta" ||
    !permit.automatedDownload ||
    !permit.fantasyUse ||
    !permit.storage ||
    !permit.derivedUse ||
    !Number.isFinite(Date.parse(permit.expiresAt)) ||
    Date.parse(permit.expiresAt) <= Date.now()
  )
    throw Error(
      "Current provider authorisation required before calendar download",
    );
  const response = await fetch(source, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!response.ok)
    throw Error("Calendar source unavailable; existing rounds unchanged");
  const body = await response.text(),
    stamp = new Date().toISOString();
  const games = parseStatisticsCsv(body, {
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
  })
    .filter((r) => r.season === String(season) && r.game_type === "REG")
    .map((r) => ({
      id: r.game_id,
      round: Number(r.week),
      home: r.home_team,
      away: r.away_team,
      kickoff:
        DateTime.fromISO(`${r.gameday}T${r.gametime}`, {
          zone: "America/New_York",
        })
          .toUTC()
          .toISO() ?? "",
    }));
  const sql = ownerDatabase();
  try {
    const existing = await sql`select stream_id from sports_feed.nfl_rounds`;
    const plan = planNflCalendar({
      season,
      source,
      verifiedAt: stamp,
      now: stamp,
      games,
      existingStreams: existing.map((r) => String(r.stream_id)),
      permitExpiresAt:
        permit.enabled && permit.scope === "isolated-free-beta"
          ? permit.expiresAt
          : "",
    });
    const output = "docs/qa/nfl-calendar-readiness";
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/plan.json`, JSON.stringify(plan, null, 2) + "\n");
    console.log(
      JSON.stringify({
        ...plan,
        rounds: plan.rounds.map(({ games: rows, ...r }) => ({
          ...r,
          fixtures: rows.length,
        })),
      }),
    );
    if (!process.argv.includes("--prepare-drafts")) return;
    if (
      !process.argv.includes("--plan-hash") ||
      value("--plan-hash") !== plan.calendarHash ||
      !process.argv.includes("--round")
    )
      throw Error("Exact reviewed --plan-hash and --round required");
    const selected = plan.rounds.find(
      (r) => r.round === Number(value("--round")),
    );
    if (!selected || !["draft-ready", "existing"].includes(selected.status))
      throw Error(
        "Round cannot be prepared: inspect deadline, calendar or provider authorisation",
      );
    if (selected.status === "existing") return; // Retry preserves existing configuration/publication.
    const players =
      await sql`select p.id player_id,p.provider_id,r.team,r.position from credits_sandbox.permanent_players p join credits_sandbox.current_player_status r on r.id=p.id where p.sport='nfl' and r.status='ACT' and r.checked_at>clock_timestamp()-interval '72 hours' and r.position in ('QB','RB','WR','TE')`;
    const prepared = [];
    for (const mode of selected.missingModes) {
      const id = nflCalendarStream(season, selected.round, mode);
      const mappings = selected.games.map((g) => {
        const mapped = players.filter((p) => [g.home, g.away].includes(p.team));
        if (
          [g.home, g.away].some(
            (team) => mapped.filter((p) => p.team === team).length < 7,
          ) ||
          mapped.some((p) => !p.provider_id)
        )
          throw Error("Verified fixture roster mapping incomplete");
        return {
          fixtureId: `${id}:${g.id}`,
          gameId: g.id,
          season,
          seasonType: "REG" as const,
          home: g.home,
          away: g.away,
          endedAt: null,
          scheduledAt: g.kickoff,
          completionEvidence:
            "https://github.com/nflverse/nflverse-data/releases/tag/pbp",
          playerIds: mapped.map((p) => String(p.player_id)),
          players: mapped.map((p) => ({
            playerId: String(p.player_id),
            gsisId: String(p.provider_id),
            team: p.team,
            position: p.position,
          })),
        };
      });
      const competition = await registerNflRound(
        sql,
        {
          id,
          sport: "nfl",
          label: `NFL Round ${selected.round} · ${mode === "OPEN" ? "All-Star" : "Traditional"}`,
          lineupVersion: nflSeven.version,
          competitionMode: mode,
          locksAt: selected.locksAt!,
          rules: sevenRules(),
          inventoryScope: "invited-nfl-test-v2",
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
        { publication: "draft" },
      );
      prepared.push({
        competition,
        mode,
        round: selected.round,
        publication: "disabled",
        calendarHash: plan.calendarHash,
      });
    }
    writeFileSync(
      `${output}/prepared-${plan.calendarHash}.json`,
      JSON.stringify({ at: stamp, prepared }, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({ prepared, publications: 0, existingRecordsChanged: 0 }),
    );
  } finally {
    await sql.end();
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Calendar preparation failed",
  );
  process.exitCode = 1;
});
