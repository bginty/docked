// Read-only follow-up: verifies retained payloads, never invokes source collection.
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine.ts";
const sql = ownerDatabase();
try {
  const r = JSON.parse(
    readFileSync("docs/qa/friends-cutover/collector-observation.json"),
  );
  const retention = [];
  for (const s of r.sources) {
    const [raw] =
      await sql`select body,body_hash,expires_at from sports_feed.raw_revisions where id=${s.raw_revision}`;
    retention.push({
      dataset: s.dataset,
      revision: s.raw_revision,
      hash: s.body_hash,
      hashMatches: digest(raw.body) === raw.body_hash,
      freshnessHours: (Date.now() - Date.parse(s.checked_at)) / 3600000,
      within24Hours: Date.now() - Date.parse(s.checked_at) < 86400000,
      retentionExpiry: raw.expires_at,
    });
  }
  const checks = ["weekly", "rosters"].map((task) => {
    const run = r.workerRuns.find(
      (x) => x.detail?.task === task && x.status === "downloaded",
    );
    const cron = r.scheduledRuns.find(
      (x) =>
        x.jobname === "docked-nfl-" + task &&
        Math.abs(Date.parse(x.start_time) - Date.parse(run.started_at)) <
          180000,
    );
    const http = r.httpResponses.find(
      (x) =>
        x.task === task &&
        x.outcome === "downloaded" &&
        String(x.rawId) === String(run.detail.rawId) &&
        x.status_code === 200 &&
        !x.timed_out &&
        Math.abs(Date.parse(x.created) - Date.parse(run.started_at)) < 180000,
    );
    return {
      task,
      startedAt: run.started_at,
      cron: cron?.status,
      httpStatus: http?.status_code ?? null,
      revision: run.detail.rawId,
      status:
        cron?.status === "succeeded" &&
        http &&
        retention.find((x) => x.dataset === task)?.hashMatches
          ? "PASS"
          : "REVIEW_REQUIRED",
    };
  });
  const pbp = r.workerRuns.find((x) => x.detail?.task === "pbp");
  const prior = r.workerRuns.find(
    (x) => x.detail?.task === "pbp" && x.status === "downloaded",
  );
  const report = {
    at: new Date().toISOString(),
    readOnly: true,
    latestScheduled: checks,
    pbp: {
      latestStartedAt: pbp.started_at,
      latestOutcome: pbp.status,
      cooldownUntil: r.sources.find((x) => x.dataset === "pbp").next_attempt,
      previousDownloadedAt: prior.started_at,
      previousRevision: prior.detail.rawId,
      previousCron: r.scheduledRuns.find(
        (x) =>
          x.jobname === "docked-nfl-pbp" &&
          Math.abs(Date.parse(x.start_time) - Date.parse(prior.started_at)) <
            180000,
      )?.status,
      previousHttpReceiptAvailable: r.httpResponses.some(
        (x) =>
          x.task === "pbp" &&
          x.outcome === "downloaded" &&
          String(x.rawId) === String(prior.detail.rawId),
      ),
      status: "REVIEW_REQUIRED",
      reason:
        "Latest cron arrived 536 ms before the existing 12-hour cooldown expired. Earlier PBP download and retained revision are recorded, but its matching HTTP receipt is no longer in the queried response store.",
    },
    retention,
    legacyEvaluator:
      "The unchanged observer evaluates the original 11 October window; that window is now outside its rolling 24-hour query. Its generic UNPROVEN results are not current source failures.",
    completedGenuineMemberRound: false,
    nextExistingPbpAttempt: "2026-10-13T00:10:00Z",
    release:
      "Already-authorised staged friends v22 remains live; missing statistics stay pending. No repeated cutover, forced download, schedule/cooldown change or new automation.",
  };
  writeFileSync(
    "docs/qa/friends-cutover/collector-followup-current.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await sql.end();
}
