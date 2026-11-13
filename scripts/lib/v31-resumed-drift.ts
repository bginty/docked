/** Read-only, bounded reconciliation. No table is exempted without row checks. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  captureInventoryScheduler,
  verifyInventorySchedulerDrift,
  inventorySchedulerTables,
} from "./inventory-scheduler-drift";
import { assertOnlyRoundTelemetryChanged } from "./round-backup-compare";
import { digest } from "../../src/core/scoring-engine";
import {
  privateDir,
  readJson,
  sourceCommit,
  packageSha256,
  evidence,
  hash,
} from "./v31-commercial-approval.mjs";
export function acceptedAdditionalBaseline() {
  const file = privateDir + "/additional-drift-approved.private.json";
  if (!existsSync(file)) return null;
  const a = readJson(file),
    manifestFile = evidence + "/additional-drift-package.json";
  const expected =
    "0e5eaaa860de858ac9f6ef16f209d4e049b099cf83bbb4f1acafb2ed802cc22e";
  assert.equal(a.approved, true);
  assert.equal(a.sourceCommit, sourceCommit);
  assert.equal(a.packageSha256, packageSha256);
  assert.equal(a.manifestSha256, expected);
  assert.equal(
    hash(readFileSync(manifestFile, "utf8").replaceAll("\r\n", "\n")),
    expected,
  );
  assert.equal(a.scope, "v31-five-observed-nfl-records-baseline-only");
  assert(
    Date.parse(a.approvedAt) <= Date.now() &&
      Date.parse(a.expiresAt) > Date.now() &&
      Date.parse(a.expiresAt) - Date.parse(a.approvedAt) <= 86400000,
  );
  const m = readJson(manifestFile);
  assert.equal(m.sourceCommit, sourceCommit);
  assert.equal(m.packageSha256, packageSha256);
  assert.equal(m.futureUnlistedDriftAllowed, false);
  assert.equal(m.sourceRightsRenewal, false);
  assert.equal(m.schedulerChanges, false);
  assert.equal(m.productionWritesAuthorizedByThisDelta, false);
  assert.deepEqual(
    m.workerRecords.map((r: any) => r.id),
    [3388, 3389, 3390],
  );
  assert.deepEqual(
    m.sourceRecords.map((r: any) => r.id),
    [12, 13],
  );
  return m;
}
export async function reconcileApprovedSourceBaseline(tx: any) {
  const m = acceptedAdditionalBaseline();
  assert(m, "Separate five-record baseline approval required");
  const old = readJson(
    privateDir + "/resumed-source-review.private.json",
  ).original;
  const q =
    "select coalesce(jsonb_agg((to_jsonb(t)-'body')||jsonb_build_object('bodyNull',body is null,'bodyMd5',md5(body::text)) order by id),'[]') value from sports_feed.raw_revisions t";
  const current = (await tx.unsafe(q))[0].value;
  assert.equal(current.length, old.length);
  for (const r of current) {
    const before = old.find((b: any) => b.id === r.id);
    assert(before);
    const allowed = m.sourceRecords.find((v: any) => v.id === r.id);
    if (!allowed) assert.deepEqual(r, before, "Unlisted source record drift");
    else {
      assert.equal(digest(before), allowed.beforeSha256);
      assert.equal(digest(r), allowed.afterSha256);
      assert(
        r.bodyNull &&
          r.bodyMd5 === null &&
          Date.parse(r.expires_at) <= Date.parse(r.purged_at),
      );
    }
  }
  return {
    manifestSha256:
      "0e5eaaa860de858ac9f6ef16f209d4e049b099cf83bbb4f1acafb2ed802cc22e",
    acceptedExistingPurges: 2,
    otherSourceRowsUnchanged: current.length - 2,
    futurePurgesAllowed: false,
  };
}
export const schedulerTables = [
  ...inventorySchedulerTables,
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_worker_runs",
];
export function driftAuthority() {
  const a = readJson(privateDir + "/scheduler-drift-approved.private.json");
  assert.equal(a.approved, true);
  assert.equal(a.sourceCommit, sourceCommit);
  assert.equal(a.packageSha256, packageSha256);
  assert.equal(a.scope, "v31-existing-nfl-scheduler-telemetry-only");
  assert(
    Date.parse(a.approvedAt) <= Date.now() &&
      Date.parse(a.expiresAt) > Date.now(),
  );
  assert(Date.parse(a.expiresAt) - Date.parse(a.approvedAt) <= 86400000);
  assert.equal(a.generalDriftProtectionsPreserved, true);
  return a;
}
export async function captureSchedulerState(tx: any) {
  return {
    bookkeeping: await captureInventoryScheduler(tx),
    rounds: (
      await tx.unsafe(
        "select coalesce(jsonb_agg(to_jsonb(t) order by competition_id),'[]') value from sports_feed.nfl_rounds t",
      )
    )[0].value,
    runs: (
      await tx.unsafe(
        "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from sports_feed.nfl_worker_runs t",
      )
    )[0].value,
  };
}
export async function verifySchedulerState(
  tx: any,
  previous: any,
  tables: any,
) {
  driftAuthority();
  const current = await captureSchedulerState(tx);
  const stable = assertOnlyRoundTelemetryChanged(
    previous.rounds,
    current.rounds,
  );
  for (const old of previous.rounds) {
    const now = current.rounds.find(
      (r: any) => r.competition_id === old.competition_id,
    );
    for (const field of ["last_checked", "next_check"]) {
      if (now[field] === old[field]) continue;
      const at = Date.parse(now[field]),
        floor = old[field] === null ? 0 : Date.parse(old[field]);
      assert(
        Number.isFinite(at) && at >= floor && at <= Date.now() + 3600000,
        "Invalid NFL telemetry time",
      );
    }
    if (now.lease_until !== null)
      assert(
        Number.isFinite(Date.parse(now.lease_until)) &&
          Date.parse(now.lease_until) <= Date.now() + 3600000,
        "Unexpected NFL lease",
      );
  }
  const previousById = new Map(previous.runs.map((r: any) => [r.id, r]));
  assert.equal(previousById.size, previous.runs.length);
  assert.equal(
    new Set(current.runs.map((r: any) => r.id)).size,
    current.runs.length,
  );
  for (const r of previous.runs)
    assert.deepEqual(
      current.runs.find((n: any) => n.id === r.id),
      r,
      "Prior NFL audit changed",
    );
  const last = Math.max(...previous.runs.map((r: any) => r.id));
  const floor = Math.max(
    ...previous.runs.map((r: any) => Date.parse(r.started_at)),
  );
  const extra = current.runs.filter((r: any) => !previousById.has(r.id));
  const additional = acceptedAdditionalBaseline();
  let acceptedPreviousFailures = 0;
  for (const r of extra) {
    const accepted = additional?.workerRecords.find((v: any) => v.id === r.id);
    if (accepted) {
      assert.equal(
        digest(r),
        accepted.sha256,
        "Accepted historic failure changed",
      );
      acceptedPreviousFailures++;
      continue;
    }
    assert(
      r.id > last &&
        r.detail?.task === "reconcile" &&
        r.status === "pending-review" &&
        r.finished_at &&
        Date.parse(r.started_at) >= floor &&
        Date.parse(r.finished_at) >= Date.parse(r.started_at) &&
        Date.parse(r.finished_at) <= Date.now() + 60000,
      "Unexpected appended NFL outcome",
    );
  }
  const bookkeeping = await verifyInventorySchedulerDrift(
    tx,
    previous.bookkeeping,
    current.bookkeeping,
    tables,
  );
  return {
    tables: schedulerTables,
    immutableRoundRows: stable.length,
    immutableRoundDigest: digest(stable),
    existingWorkerAuditRowsUnchanged: previous.runs.length,
    appendedPendingReviewReconcileRows: extra.length - acceptedPreviousFailures,
    acceptedExactHistoricalFailureRows: acceptedPreviousFailures,
    ...bookkeeping,
  };
}
export async function reconcileOriginalWarningCorrection(
  tx: any,
  original: any,
) {
  const frozen = readJson(
    privateDir +
      "/../v31-revenue-launch-20261113/historical-notifications.private.json",
  ).rows;
  const rows = (
    await tx.unsafe(
      "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from credits_sandbox.store_notifications t",
    )
  )[0].value;
  assert.equal(rows.length, original.notifications.length);
  const ids = new Set(frozen.map((r: any) => r.id));
  assert.equal(ids.size, 7);
  const stable = (r: any) =>
    Object.fromEntries(
      Object.entries(r).filter(
        ([k]) => !["state", "completed_at", "lease_until"].includes(k),
      ),
    );
  for (const old of original.notifications) {
    const now = rows.find((r: any) => r.id === old.id);
    assert(now);
    if (ids.has(old.id)) {
      assert.deepEqual(
        old,
        frozen.find((r: any) => r.id === old.id),
      );
      assert.equal(now.state, "done");
      assert(now.completed_at);
      assert.equal(now.lease_until, null);
      assert.deepEqual(stable(now), stable(old));
    } else assert.deepEqual(now, old, "Unrelated notification changed");
  }
  const audit = (
    await tx.unsafe(
      "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from private.audit_events t",
    )
  )[0].value;
  for (const old of original.audit)
    assert.deepEqual(
      audit.find((r: any) => r.id === old.id),
      old,
      "Prior immutable audit changed",
    );
  const oldIds = new Set(original.audit.map((r: any) => r.id));
  const added = audit.filter((r: any) => !oldIds.has(r.id));
  assert.equal(added.length, 1);
  const event = added[0];
  assert.equal(event.action, "historical-google-test-externally-reconciled");
  assert.equal(event.subject, "v31-seven-preview-test-notifications");
  assert.equal(
    digest(event.details.before),
    digest([...frozen].sort((a: any, b: any) => a.id.localeCompare(b.id))),
  );
  assert.equal(
    digest(event.details.after),
    digest(rows.filter((r: any) => ids.has(r.id))),
  );
  assert.equal(
    event.details.packageSha256,
    "657f783584433220e42e1e5834237f3ecfe69755292da9ee6599caaa651d325f",
  );
  return {
    notificationsCorrected: 7,
    unrelatedNotificationsUnchanged: true,
    immutableAuditEventsAdded: 1,
    priorAuditEventsUnchanged: true,
  };
}
