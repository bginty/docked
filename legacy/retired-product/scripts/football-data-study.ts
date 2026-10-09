import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  parseOpenFootballDataset,
  openFootballQualityReport,
} from "../src/core/openfootball-dataset";
import { reviewedOpenFootballSources } from "../src/core/research-source-catalogue";
import { sourceUseDecision } from "../src/core/research-engine";
import {
  openFootballTeamId,
  footballTeamMappingVersion,
  footballTeamAliases,
} from "../src/core/football-team-mapping";
import {
  initialPoissonConfig,
  validatePoissonTraining,
} from "../src/core/football-poisson";
import { phase5Hash } from "../src/core/phase5-hash";

async function main() {
  const asOfTime = new Date().toISOString();
  const reviewed = [
    {
      season: "2025-26",
      sha: "d6070bdf731546ccf97767f062e8af4bd26dd309dee69f6092025bf9c78f43c1",
      observedAt: "2026-10-04T02:38:21.2512221Z",
    },
    {
      season: "2026-27",
      sha: "bb91f0ab3e8359df163bb9ec98549bfed85e200dd4c32f3bd606b5890d932dd2",
      observedAt: "2026-10-04T02:38:21.5860698Z",
    },
  ];
  const matches = [],
    excluded = [],
    resources = [],
    failures: string[] = [];
  for (const r of reviewed) {
    const source = reviewedOpenFootballSources().find(
      (s) => s.sourceId === `openfootball-epl-${r.season}`,
    )!;
    const decision = sourceUseDecision(source, {
      purpose: "MODEL",
      asOfTime,
      jurisdiction: "AU:NSW",
    });
    if (!decision.allowed) throw Error(decision.reasons.join(","));
    const raw = await readFile(
      `private-data/phase5c/openfootball-${r.season}.json`,
    );
    if (createHash("sha256").update(raw).digest("hex") !== r.sha)
      throw Error("Reviewed source hash mismatch");
    const data = parseOpenFootballDataset(JSON.parse(raw.toString("utf8")), {
      observedAt: r.observedAt,
      sourceId: source.sourceId,
      sourceVersion: source.version,
    });
    const quality = openFootballQualityReport(data),
      counts: Record<string, number> = {};
    for (const row of data.matches) {
      const home = openFootballTeamId(row.homeTeam),
        away = openFootballTeamId(row.awayTeam);
      counts[home] = (counts[home] ?? 0) + 1;
      counts[away] = (counts[away] ?? 0) + 1;
      const year = Number(r.season.slice(0, 4));
      if (
        row.scheduledDate < `${year}-07-01` ||
        row.scheduledDate > `${year + 1}-06-30`
      )
        failures.push(`SEASON_DATE:${row.sourceItemId}`);
      const reason =
        row.scoreField !== "FT_FIELD"
          ? row.scoreField
          : row.scheduledDate >= r.observedAt.slice(0, 10)
            ? "DATE_FINALITY_UNAVAILABLE"
            : null;
      if (reason)
        excluded.push({
          id: row.sourceItemId,
          sourceId: source.sourceId,
          reason,
        });
      else
        matches.push({
          id: row.sourceItemId,
          home,
          away,
          date: row.scheduledDate,
          homeGoals: row.homeGoals!,
          awayGoals: row.awayGoals!,
          observedAt: r.observedAt,
          sourceId: source.sourceId,
        });
    }
    if (
      quality.teams !== 20 ||
      quality.records !== 380 ||
      Object.values(counts).some((n) => n !== 38)
    )
      failures.push(`PAIRING_COVERAGE:${r.season}`);
    if (quality.futureReportedScores)
      failures.push(`FUTURE_SCORES:${r.season}`);
    resources.push({
      ...r,
      endpoint: source.endpoint,
      sourceVersion: source.version,
      rightsEvidence: source.evidenceUrls,
      quality,
      teamAppearanceCounts: counts,
    });
  }
  const training = validatePoissonTraining({
    schemaVersion: "epl-poisson-training-v1",
    competitionId: "soccer_epl",
    asOfTime,
    matches,
  });
  const report = {
    schemaVersion: "football-training-study-v1",
    asOfTime,
    codeCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    resources,
    mappingVersion: footballTeamMappingVersion,
    aliases: footballTeamAliases,
    included: training.matches.length,
    excluded,
    failures,
    configuration: initialPoissonConfig,
    configurationHash: phase5Hash(initialPoissonConfig),
    trainingHash: phase5Hash(training),
    acceptance: failures.length
      ? "BLOCKED"
      : "AWAITING_RESEARCH_QUALITY_REVIEW",
    settlementReady: false,
    officialRecordCreated: false,
  };
  await mkdir("private-data/phase5d", { recursive: true });
  await mkdir("docs/qa/phase5d", { recursive: true });
  await writeFile(
    "private-data/phase5d/training-study.json",
    JSON.stringify({ report, training }, null, 2),
    { flag: "wx" },
  );
  await writeFile(
    "docs/qa/phase5d/data-study.json",
    JSON.stringify(report, null, 2),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      included: report.included,
      excluded: excluded.length,
      failures,
      acceptance: report.acceptance,
      trainingHash: report.trainingHash,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Study failed");
  process.exitCode = 1;
});
