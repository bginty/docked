/** No writes. Requires distinct founder acceptance of the diagnosed drift. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { assertOnlyRoundTelemetryChanged } from "./round-backup-compare";
import {
  privateDir,
  evidence,
  readJson,
  sourceCommit,
  packageSha256,
} from "./v31-commercial-approval.mjs";
import { digest } from "../../src/core/scoring-engine";
export async function approvedSchedulerDrift(tx: any) {
  const file = privateDir + "/scheduler-drift-approved.private.json";
  if (!existsSync(file)) return null;
  const a = readJson(file);
  assert.equal(a.approved, true);
  assert.equal(a.sourceCommit, sourceCommit);
  assert.equal(a.packageSha256, packageSha256);
  assert.equal(a.scope, "v31-existing-nfl-scheduler-telemetry-only");
  assert(
    Date.parse(a.approvedAt) <= Date.now() &&
      Date.parse(a.expiresAt) > Date.now() &&
      Date.parse(a.expiresAt) - Date.parse(a.approvedAt) <= 86400000,
  );
  const b = readJson(privateDir + "/scheduler-baseline.private.json"),
    proof = readJson(evidence + "/scheduler-drift-explained.json");
  assert.equal(proof.sourceCommit, sourceCommit);
  assert.equal(proof.immutableRoundDigest, b.immutableDigest);
  const rounds = (
    await tx`select jsonb_agg(to_jsonb(t) order by competition_id) value from sports_feed.nfl_rounds t`
  )[0].value;
  const stable = assertOnlyRoundTelemetryChanged(b.previousRounds, rounds);
  assert.equal(digest(stable), proof.immutableRoundDigest);
  const runs = (
    await tx`select jsonb_agg(to_jsonb(t) order by id) value from sports_feed.nfl_worker_runs t`
  )[0].value;
  for (const r of b.previousRuns)
    assert.deepEqual(
      runs.find((n: any) => n.id === r.id),
      r,
      "Original worker audit changed",
    );
  const ids = new Set(b.previousRuns.map((r: any) => r.id)),
    last = Math.max(...(ids as Set<number>)),
    extra = runs.filter((r: any) => !ids.has(r.id));
  assert(
    extra.every(
      (r: any) =>
        r.id > last &&
        r.detail.task === "reconcile" &&
        r.status === "pending-review" &&
        r.finished_at,
    ),
    "Unexpected new worker result",
  );
  return {
    tables: ["sports_feed.nfl_rounds", "sports_feed.nfl_worker_runs"],
    immutableRoundRows: stable.length,
    immutableRoundDigest: proof.immutableRoundDigest,
    existingWorkerAuditRowsUnchanged: b.previousRuns.length,
    appendedPendingReviewReconcileRows: extra.length,
    allowedRoundFields: ["last_checked", "next_check", "lease_until"],
    productionWrites: 0,
  };
}
