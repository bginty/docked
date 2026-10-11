import test from "node:test";
import assert from "node:assert/strict";
import {
  collectorReleaseEvidence,
  dueSources,
} from "../../scripts/collector-release-evidence.mjs";

const now = Date.parse("2026-10-11T12:20:00Z");
const fixture = () => {
  const tasks: [string, string][] = Object.entries(dueSources);
  return {
    projectRef: "pojoymtniryarxxunyvz",
    readOnly: true,
    jobs: tasks.map(([task]) => ({
      jobname: "docked-nfl-" + task,
      active: true,
    })),
    scheduledRuns: tasks.map(([task, due]) => ({
      jobname: "docked-nfl-" + task,
      start_time: due,
      status: "succeeded",
    })),
    workerRuns: tasks.map(([task, due], i) => ({
      started_at: due,
      finished_at: due,
      status: "not-modified",
      detail: { task, season: 2026, rawId: i + 1 },
    })),
    httpResponses: tasks.map(([task, due], i) => ({
      created: due,
      status_code: 200,
      timed_out: false,
      task,
      season: 2026,
      outcome: "not-modified",
      rawId: i + 1,
    })),
    sources: tasks.map(([task, due], i) => ({
      dataset: task,
      checked_at: due,
      raw_revision: String(i + 1),
      error_code: null,
      body_hash: "a".repeat(64),
      expires_at: "2026-11-01T00:00:00Z",
    })),
  };
};
test("conditional source checks count without inventing a new download or completed member round", () => {
  const result = collectorReleaseEvidence(fixture(), now);
  assert.equal(result.status, "PASS");
  assert.equal(result.completedMemberRound, false);
  assert.equal(result.sources[0].outcome, "not-modified");
});
test("idle, cooldown, stale evidence, wrong raw revision and cron-only success cannot pass", () => {
  for (const change of [
    (r: ReturnType<typeof fixture>) => {
      r.workerRuns[0].status = "idle";
    },
    (r: ReturnType<typeof fixture>) => {
      r.workerRuns[0].status = "cooldown";
    },
    (r: ReturnType<typeof fixture>) => {
      r.sources[0].checked_at = "2026-10-10T12:05:00Z";
    },
    (r: ReturnType<typeof fixture>) => {
      r.httpResponses[0].rawId = 999;
    },
    (r: ReturnType<typeof fixture>) => {
      r.workerRuns = [];
    },
    (r: ReturnType<typeof fixture>) => {
      r.sources[0].expires_at = "2026-10-11T00:00:00Z";
    },
    (r: ReturnType<typeof fixture>) => {
      r.jobs[0].active = false;
    },
  ]) {
    const input = fixture();
    change(input);
    assert.equal(
      collectorReleaseEvidence(input, now).status,
      "REVIEW_REQUIRED",
    );
  }
});
test("a not-yet-due check stays waiting and unrelated projects are rejected", () => {
  assert.equal(
    collectorReleaseEvidence(fixture(), Date.parse("2026-10-11T04:00:00Z"))
      .status,
    "WAIT_FOR_EXISTING_SCHEDULE",
  );
  assert.throws(() =>
    collectorReleaseEvidence({ ...fixture(), projectRef: "other" }, now),
  );
});
