// Pure evidence interpretation. Never triggers collection or changes readiness.
export const dueSources = Object.freeze({
  weekly: "2026-10-11T12:05:00.000Z",
  pbp: "2026-10-11T12:10:00.000Z",
  rosters: "2026-10-11T12:15:00.000Z",
});
const time = (value) => Date.parse(value);
export function collectorReleaseEvidence(report, now = Date.now()) {
  if (report.projectRef !== "pojoymtniryarxxunyvz" || !report.readOnly)
    throw Error("Unexpected collector evidence target");
  const sources = Object.entries(dueSources).map(([task, due]) => {
    const reasons = [];
    const start = time(due);
    const within = (value) =>
      time(value) >= start && time(value) <= start + 180000;
    const cron = report.scheduledRuns?.find(
      (r) => r.jobname === "docked-nfl-" + task && within(r.start_time),
    );
    const run = report.workerRuns?.find(
      (r) =>
        r.detail?.task === task &&
        r.detail?.season === 2026 &&
        within(r.started_at),
    );
    const source = report.sources?.find((r) => r.dataset === task);
    const http = report.httpResponses?.find(
      (r) =>
        r.task === task &&
        r.season === 2026 &&
        within(r.created) &&
        r.status_code === 200 &&
        r.timed_out === false &&
        r.outcome === run?.status &&
        String(r.rawId) === String(run?.detail?.rawId),
    );
    if (
      !report.jobs?.some((r) => r.jobname === "docked-nfl-" + task && r.active)
    )
      reasons.push("SCHEDULE_DISABLED_OR_MISSING");
    if (!cron || cron.status !== "succeeded")
      reasons.push("CRON_EXECUTION_UNPROVEN");
    if (
      !run ||
      !["downloaded", "not-modified"].includes(run.status) ||
      !Number.isFinite(time(run.finished_at)) ||
      time(run.finished_at) > now
    )
      reasons.push("SOURCE_ACCESS_UNPROVEN");
    if (!http) reasons.push("MATCHING_HTTP_COMPLETION_UNPROVEN");
    if (
      !source ||
      source.error_code ||
      !within(source.checked_at) ||
      time(source.checked_at) > now ||
      !Number.isFinite(time(source.expires_at)) ||
      time(source.expires_at) <= now ||
      !/^[a-f0-9]{64}$/.test(source.body_hash ?? "") ||
      String(source.raw_revision) !== String(run?.detail?.rawId)
    )
      reasons.push("RETAINED_SOURCE_UNPROVEN");
    return {
      task,
      due,
      outcome: run?.status ?? null,
      status:
        now < start + 180000
          ? "NOT_DUE_OR_RUNNING"
          : reasons.length
            ? "REVIEW_REQUIRED"
            : "PASS",
      reasons,
    };
  });
  return {
    observedAt: new Date(now).toISOString(),
    status: sources.every((s) => s.status === "PASS")
      ? "PASS"
      : sources.some((s) => s.status === "NOT_DUE_OR_RUNNING")
        ? "WAIT_FOR_EXISTING_SCHEDULE"
        : "REVIEW_REQUIRED",
    sources,
    correlation:
      "Task, season, time window, outcome and raw revision; not a request-ID join. Review anomalies before certifying.",
    completedMemberRound: false,
    meaning:
      "Source collection evidence only. Does not certify domain, admission, scoring finalisation or release readiness.",
  };
}
