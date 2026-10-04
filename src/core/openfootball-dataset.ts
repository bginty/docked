import { z } from "zod";
import { phase5Hash } from "./phase5-hash";

const sourceId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const date = z.iso.date();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const score = z.tuple([
  z.number().int().min(0).max(100),
  z.number().int().min(0).max(100),
]);
const match = z
  .object({
    round: z.string().min(1).max(100),
    date,
    time: time.optional(),
    team1: z.string().trim().min(1).max(120),
    team2: z.string().trim().min(1).max(120),
    score: z
      .union([
        score,
        z.object({ ft: score.optional(), ht: score.optional() }).strict(),
      ])
      .optional(),
  })
  .strict()
  .refine((v) => v.team1 !== v.team2, "Distinct teams required");
const dataset = z
  .object({
    name: z.string().regex(/^English Premier League \d{4}\/\d{2}$/),
    matches: z.array(match).min(1).max(1000),
  })
  .strict();
const metadata = z
  .object({
    observedAt: z.iso.datetime({ offset: true }),
    sourceId,
    sourceVersion: sourceId,
  })
  .strict();

/** A source-reported dataset is not an authoritative regulation result or a UTC fixture. */
export function parseOpenFootballDataset(
  payload: unknown,
  provenance: z.infer<typeof metadata>,
) {
  const parsed = dataset.parse(payload),
    meta = metadata.parse(provenance);
  const season = parsed.name.slice("English Premier League ".length);
  const [year, end] = season.split("/");
  if ((Number(year) + 1) % 100 !== Number(end))
    throw Error("SOURCE_ADAPTER_DEGRADED: inconsistent season");
  const ids = new Set<string>();
  const matches = parsed.matches.map((row) => {
    const sourceItemId = phase5Hash({
      competitionId: "soccer_epl",
      season,
      home: row.team1,
      away: row.team2,
    });
    if (ids.has(sourceItemId))
      throw Error("SOURCE_ADAPTER_DEGRADED: duplicate team pairing");
    ids.add(sourceItemId);
    const labelledScore =
      row.score && !Array.isArray(row.score) ? row.score : null;
    const reportedScore = Array.isArray(row.score)
      ? row.score
      : labelledScore?.ft;
    if (
      labelledScore?.ht &&
      labelledScore.ft &&
      labelledScore.ht.some((value, i) => value > labelledScore.ft![i])
    )
      throw Error("SOURCE_ADAPTER_DEGRADED: impossible half-time score");
    return {
      sourceItemId,
      homeTeam: row.team1,
      awayTeam: row.team2,
      scheduledDate: row.date,
      scheduledTime: row.time ?? null,
      homeGoals: reportedScore?.[0] ?? null,
      awayGoals: reportedScore?.[1] ?? null,
      scoreField: Array.isArray(row.score)
        ? ("UNLABELLED_SCORE" as const)
        : labelledScore?.ft
          ? ("FT_FIELD" as const)
          : ("ABSENT" as const),
      resultSemantics: "REPORTED_UNVERIFIED_REGULATION" as const,
    };
  });
  return {
    schemaVersion: "openfootball-research-dataset-v1" as const,
    competitionId: "soccer_epl" as const,
    season,
    sourceId: meta.sourceId,
    sourceVersion: meta.sourceVersion,
    sourcePublishedAt: null,
    sourceObservedAt: meta.observedAt,
    matches,
  };
}
export type OpenFootballResearchDataset = ReturnType<
  typeof parseOpenFootballDataset
>;

/** Describes evidence gaps; this never promotes reported scores into the model or settlement ledger. */
export function openFootballQualityReport(value: OpenFootballResearchDataset) {
  const observedDate = value.sourceObservedAt.slice(0, 10);
  const teams = new Set(
    value.matches.flatMap((row) => [row.homeTeam, row.awayTeam]),
  );
  const scores = value.matches.filter(
    (row) => row.homeGoals !== null && row.awayGoals !== null,
  );
  const futureReportedScores = scores.filter(
    (row) => row.scheduledDate > observedDate,
  ).length;
  return {
    schemaVersion: "openfootball-quality-v1" as const,
    sourceId: value.sourceId,
    sourceVersion: value.sourceVersion,
    observedAt: value.sourceObservedAt,
    competitionId: value.competitionId,
    season: value.season,
    records: value.matches.length,
    teams: teams.size,
    reportedScores: scores.length,
    missingScores: value.matches.length - scores.length,
    unlabelledScores: value.matches.filter(
      (row) => row.scoreField === "UNLABELLED_SCORE",
    ).length,
    missingLocalTimes: value.matches.filter((row) => row.scheduledTime === null)
      .length,
    futureReportedScores,
    expectedDoubleRoundRobinRecords: teams.size * (teams.size - 1),
    canonicalTeamMapping: "NOT_REVIEWED",
    timestampTimezone: "NOT_SUPPLIED",
    sourcePublicationTimes: "NOT_SUPPLIED",
    resultCorrectionLineage: "NOT_SUPPLIED",
    authoritativeRegulationFinality: "NOT_ESTABLISHED",
    modelReady: false,
    settlementReady: false,
    status: futureReportedScores ? "SOURCE_ADAPTER_DEGRADED" : "RESEARCH_ONLY",
    datasetHash: phase5Hash(value),
  };
}
