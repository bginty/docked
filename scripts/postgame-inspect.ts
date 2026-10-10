import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchNflverseCsv } from "../src/server/postgame-download";
import {
  nflversePlayerStatistics,
  parseStatisticsCsv,
} from "../src/core/postgame-nflverse";
import { scorePlayer } from "../src/core/scoring-v1";
import { currentRulesets } from "../src/core/scoring-release";

async function main() {
  // Explicit research command, not a hosted activation or scoring import. Run at
  // most once per 12h; the deployed-worker foundation enforces this in PostgreSQL.
  const path = "tmp/postgame-investigation/nfl-2026-adapter.csv";
  let csv: string,
    transport: unknown = { mode: "previous-local-download" };
  if (process.argv.includes("--download")) {
    const data = await fetchNflverseCsv(2026, {});
    if (data.notModified) throw Error("No cached download supplied");
    csv = data.csv;
    transport = {
      mode: "actual-public-download",
      etag: data.etag,
      sourceModified: data.modified,
    };
    await mkdir("tmp/postgame-investigation", { recursive: true });
    await writeFile(path, csv);
  } else csv = await readFile(path, "utf8");
  const rows = parseStatisticsCsv(csv),
    offensive = rows.filter((r) =>
      ["QB", "RB", "WR", "TE"].includes(r.position),
    );
  const identifiers = rows.map((r) => `${r.game_id}:${r.player_id}`);
  const issues = offensive.flatMap((r) => {
    const result = nflversePlayerStatistics(r);
    return result.issue
      ? [{ playerId: r.player_id, gameId: r.game_id, issue: result.issue }]
      : [];
  });
  const expected = new Map([
    ["00-0023459", 1254],
    ["00-0036894", 1310],
    ["00-0037228", 780],
    ["00-0038542", 2730],
  ]);
  const arithmetic = offensive
    .filter((r) => r.game_id === "2026_01_ATL_PIT" && expected.has(r.player_id))
    .map((r) => {
      const normalized = nflversePlayerStatistics(r);
      if (!normalized.stats) throw Error("Reconciliation sample incomplete");
      const cp = scorePlayer(
        currentRulesets.nfl,
        r.position,
        normalized.stats,
      ).centipoints;
      if (cp !== expected.get(r.player_id))
        throw Error("Downloaded source changed: manually review sample again");
      return {
        playerId: r.player_id,
        name: r.player_display_name,
        gameId: r.game_id,
        centipoints: cp,
        manualArithmeticMatched: true,
      };
    });
  if (arithmetic.length !== 4 || new Set(identifiers).size !== rows.length)
    throw Error("Source sample/identifier validation failed");
  const report = {
    checkedAt: new Date().toISOString(),
    source:
      "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv",
    transport,
    sha256: createHash("sha256").update(csv).digest("hex"),
    rows: rows.length,
    uniqueGamePlayerIds: new Set(identifiers).size,
    games: new Set(rows.map((r) => r.game_id)).size,
    offensiveRows: offensive.length,
    normalizableOffensiveRows: offensive.length - issues.length,
    pending: issues,
    arithmetic,
    boundaries: [
      "Downloaded source statistics, not fabricated or live Docked results",
      "Manual arithmetic verified, independent gamebook audit not performed",
      "Current-season existence is not a complete active roster",
      "Exact completion time absent; external completion evidence required",
      "No member result, competition or inventory mutation",
      "No hosted rights/ingestion activation implied",
    ],
  };
  await mkdir("docs/qa/free-beta-data", { recursive: true });
  await writeFile(
    "docs/qa/free-beta-data/postgame-real-download.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Post-game investigation failed",
  );
  process.exitCode = 1;
});
