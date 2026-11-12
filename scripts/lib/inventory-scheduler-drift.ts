import assert from "node:assert/strict";

type Database = { unsafe(query: string, params?: string[]): Promise<any[]> };
type Checksum = { count: number; hash: string };
export type InventoryScheduler = {
  mail: { immutable: string; tick: string | null };
  mailRows: number;
  cronMax: string;
  weeklyMax: string;
};
export const inventorySchedulerTables = [
  "cron.job_run_details",
  "private.docked_mail_scheduler",
  "sports_feed.weekly_core_job_runs",
] as const;

/** Only metadata is retained. Existing log rows are verified again by prefix
 * checksum; neither this helper nor its caller changes a scheduler or job. */
export async function captureInventoryScheduler(
  tx: Database,
): Promise<InventoryScheduler> {
  const [r] = await tx.unsafe(`select
    (select jsonb_build_object('immutable',md5((to_jsonb(m)-'last_tick_at')::text),
      'tick',last_tick_at::text) from private.docked_mail_scheduler m where singleton) mail,
    (select count(*)::int from private.docked_mail_scheduler) "mailRows",
    (select coalesce(max(runid),0)::text from cron.job_run_details) "cronMax",
    (select coalesce(max(started_at),'1970-01-01'::timestamptz)::text from sports_feed.weekly_core_job_runs) "weeklyMax"`);
  assert(r?.mail, "Expected existing mail scheduler singleton");
  return r as InventoryScheduler;
}

export async function verifyInventorySchedulerDrift(
  tx: Database,
  previous: InventoryScheduler,
  current: InventoryScheduler,
  previousTables: Record<string, Checksum>,
) {
  assert(previous && current, "New scheduler-aware preflight required");
  assert.equal(
    previous.mailRows,
    1,
    "Expected one previous mail scheduler row",
  );
  assert.equal(current.mailRows, 1, "Mail scheduler row added or removed");
  assert.equal(
    current.mail.immutable,
    previous.mail.immutable,
    "Mail scheduler configuration or request state changed",
  );
  const tick = (v: string | null) => (v === null ? null : Date.parse(v));
  const oldTick = tick(previous.mail.tick),
    newTick = tick(current.mail.tick);
  assert(
    newTick === oldTick ||
      (Number.isFinite(newTick) &&
        newTick !== null &&
        (oldTick === null || newTick >= oldTick) &&
        newTick <= Date.now() + 60_000),
    "Mail tick moved backwards or into future",
  );
  assert.match(previous.cronMax, /^\d+$/);
  assert(
    Number.isFinite(Date.parse(previous.weeklyMax)),
    "Invalid weekly log boundary",
  );
  const prefix = async (table: string, predicate: string, boundary: string) => {
    const [r] = await tx.unsafe(
      `select count(*)::int count,
      md5(coalesce(string_agg(h,'' order by h),'')) hash from
      (select md5(to_jsonb(t)::text) h from ${table} t where ${predicate}) q`,
      [boundary],
    );
    assert.deepEqual(
      r,
      previousTables[table],
      `Existing scheduler history changed: ${table}`,
    );
  };
  await prefix("cron.job_run_details", "runid <= $1::bigint", previous.cronMax);
  await prefix(
    "sports_feed.weekly_core_job_runs",
    // Bind text first: the driver's timestamptz serializer otherwise truncates
    // PostgreSQL microseconds to JavaScript milliseconds at this boundary.
    "started_at <= $1::text::timestamptz",
    previous.weeklyMax,
  );
  const [cron] = await tx.unsafe(
    `select count(*)::int added,
    count(*) filter(where j.jobid is null or r.command is distinct from j.command
      or r.database is distinct from j.database or r.username is distinct from j.username
      or r.status is null or r.status not in ('succeeded','running','starting','connecting','sending')
      or r.start_time is null or r.start_time > clock_timestamp()+interval '1 minute'
      or r.start_time < (select coalesce(max(start_time),'1970-01-01'::timestamptz) from cron.job_run_details where runid <= $1::bigint)
    )::int invalid from cron.job_run_details r left join cron.job j using(jobid)
    where r.runid > $1::bigint`,
    [previous.cronMax],
  );
  const [weekly] = await tx.unsafe(
    `select count(*)::int added,
    count(*) filter(where issued <> 0 or failures <> 0 or issued is null or failures is null
      or status not in ('complete','running') or status is null
      or started_at > clock_timestamp()+interval '1 minute')::int invalid
    from sports_feed.weekly_core_job_runs where started_at > $1::text::timestamptz`,
    [previous.weeklyMax],
  );
  assert.equal(
    cron.invalid,
    0,
    "New cron record has changed job identity, command, failure or invalid time",
  );
  assert.equal(
    weekly.invalid,
    0,
    "Weekly job issued cards, failed or has invalid state/time",
  );
  return {
    cronRowsAdded: cron.added,
    weeklyZeroIssuanceRowsAdded: weekly.added,
    mailTickAdvanced: newTick !== oldTick,
    existingHistoryUnchanged: true,
  };
}
