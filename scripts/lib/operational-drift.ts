import assert from "node:assert/strict";
import type { BackupRow } from "./backup-row-review";
const serial = (r: BackupRow, omitted: string[] = []) =>
  JSON.stringify(
    Object.keys(r)
      .filter((k) => !omitted.includes(k))
      .sort()
      .map((k) => [k, r[k]]),
  );
const timestamp = (s: string | null) => {
  if (s === null) return null;
  let value = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) value += "Z";
  const n = Date.parse(value);
  assert(Number.isFinite(n), "Invalid operational timestamp");
  return n;
};
export function assertOperationalDrift(
  table: string,
  previous: BackupRow[],
  current: BackupRow[],
  context: {
    sessions: BackupRow[];
    jobs: BackupRow[];
    rotatedSessions?: string[];
  },
) {
  const name = table.replaceAll('"', "");
  const spec: Record<
    string,
    { key: string; fields: string[]; append?: boolean; time?: string }
  > = {
    "auth.users": { key: "id", fields: ["updated_at"] },
    "auth.sessions": {
      key: "id",
      fields: ["updated_at", "refreshed_at", "ip"],
    },
    "auth.refresh_tokens": {
      key: "id",
      fields: ["updated_at", "revoked"],
      append: true,
      time: "created_at",
    },
    "private.docked_mail_scheduler": {
      key: "singleton",
      fields: ["last_tick_at"],
    },
    "cron.job_run_details": {
      key: "runid",
      fields: [],
      append: true,
      time: "start_time",
    },
    "sports_feed.nfl_worker_runs": {
      key: "id",
      fields: [],
      append: true,
      time: "started_at",
    },
    "sports_feed.weekly_core_job_runs": {
      key: "id",
      fields: [],
      append: true,
      time: "started_at",
    },
  };
  const rule = spec[name];
  assert(rule, "Unreviewed operational table");
  const old = new Map(previous.map((r) => [r[rule.key], r]));
  const now = new Map(current.map((r) => [r[rule.key], r]));
  assert(
    old.size === previous.length && now.size === current.length,
    "Duplicate operational key",
  );
  for (const [key, p] of old) {
    const r = now.get(key);
    assert(r, "Existing operational record removed");
    assert(
      serial(p, rule.fields) === serial(r, rule.fields),
      "Non-operational fields changed",
    );
    for (const field of rule.fields) {
      if (field === "ip") {
        assert(
          p.ip === r.ip || context.rotatedSessions?.includes(r.id!),
          "Session address changed without a verified token rotation",
        );
        continue;
      }
      if (field === "revoked") {
        assert(
          p[field] === r[field] || (p[field] === "f" && r[field] === "t"),
          "Invalid token revocation transition",
        );
        continue;
      }
      const before = timestamp(p[field]),
        after = timestamp(r[field]);
      assert(
        after === before ||
          (after !== null &&
            (before === null || after >= before) &&
            after <= Date.now() + 60000),
        "Timestamp moved backwards or into future",
      );
    }
  }
  const added = current.filter((r) => !old.has(r[rule.key]));
  assert(
    rule.append || added.length === 0,
    "Identity or configuration row added",
  );
  if (added.length) {
    const floor = Math.max(
      ...previous.map((r) => timestamp(r[rule.time!]) ?? 0),
    );
    for (const r of added) {
      const at = timestamp(r[rule.time!]);
      assert(
        at !== null && at >= floor && at <= Date.now() + 60000,
        "Backdated/future operational row",
      );
      if (name === "auth.refresh_tokens") {
        const tokens = new Map(current.map((v) => [v.token, v]));
        assert(tokens.size === current.length, "Duplicate refresh token");
        const session = context.sessions.find((s) => s.id === r.session_id);
        assert(
          session && session.user_id === r.user_id,
          "Token member/session binding changed",
        );
        let child = r;
        const seen = new Set<string | null>();
        while (!old.has(child.id)) {
          assert(
            child.parent && !seen.has(child.parent),
            "Missing or cyclic refresh ancestor",
          );
          seen.add(child.parent);
          const parent = tokens.get(child.parent);
          assert(
            parent &&
              parent.user_id === r.user_id &&
              parent.session_id === r.session_id &&
              parent.instance_id === r.instance_id,
            "Refresh ancestor binding changed",
          );
          assert(parent.revoked === "t", "Rotated predecessor not revoked");
          child = parent;
        }
        assert(r.revoked === "t" || r.revoked === "f", "Invalid refresh state");
      } else if (name === "cron.job_run_details") {
        const job = context.jobs.find((j) => j.jobid === r.jobid);
        assert(
          job &&
            job.command === r.command &&
            job.database === r.database &&
            job.username === r.username,
          "Scheduler job identity/command changed",
        );
      } else if (name === "sports_feed.weekly_core_job_runs") {
        assert(
          r.issued === "0" && r.failures === "0",
          "Weekly issuance or failures require fresh review",
        );
      }
    }
  }
  return {
    table,
    fields: rule.fields,
    immutableRows: previous.length,
    addedRows: added.length,
    comparison:
      "Every existing immutable field matches; timestamp/rotation/append invariants verified; no values disclosed",
  };
}
