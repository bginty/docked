import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  captureInventoryScheduler,
  verifyInventorySchedulerDrift,
} from "../../scripts/lib/inventory-scheduler-drift";
import { checksumQuery } from "../../scripts/lib/reviewed-inventory";

test("inventory scheduler exception verifies immutable history, configuration and zero issuance in PostgreSQL", async (t) => {
  const db = new PGlite();
  const tx = {
    unsafe: async (query: string, params?: string[]) =>
      (await db.query(query, params)).rows as any[],
  };
  try {
    await db.exec(`create schema cron; create schema private; create schema sports_feed;
      create table cron.job(jobid bigint primary key, command text,database text,username text);
      create table cron.job_run_details(runid bigint primary key,jobid bigint,command text,database text,username text,status text,start_time timestamptz,end_time timestamptz);
      create table private.docked_mail_scheduler(singleton bool primary key,enabled bool,project_ref text,last_tick_at timestamptz,last_request_at timestamptz,last_request_id bigint,last_error_code text);
      create table sports_feed.weekly_core_job_runs(id uuid primary key,started_at timestamptz,finished_at timestamptz,issued int,failures int,status text);
      insert into cron.job values(1,'select 1','postgres','postgres');
      insert into cron.job_run_details values(1,1,'select 1','postgres','postgres','succeeded',now()-interval '1 minute',now()-interval '59 seconds');
      insert into private.docked_mail_scheduler values(true,true,'synthetic',now()-interval '1 minute',null,null,null);
      insert into sports_feed.weekly_core_job_runs values('00000000-0000-0000-0000-000000000001',now()-interval '1 minute',now()-interval '59 seconds',0,0,'complete');`);
    const previous = await captureInventoryScheduler(tx);
    const previousTables: Record<string, any> = {};
    for (const name of [
      "cron.job_run_details",
      "private.docked_mail_scheduler",
      "sports_feed.weekly_core_job_runs",
    ])
      previousTables[name] = (await tx.unsafe(checksumQuery(name)))[0].value;
    // The operator stores only count/hash under each table key.
    for (const row of Object.values(previousTables)) delete row.table;
    const benign = `update private.docked_mail_scheduler set last_tick_at=now();
      insert into cron.job_run_details values(2,1,'select 1','postgres','postgres','succeeded',now(),now());
      insert into sports_feed.weekly_core_job_runs values('00000000-0000-0000-0000-000000000002',now(),now(),0,0,'complete');`;
    const cases = [
      [
        "allows only forward mail tick and existing-job zero-issuance log appends",
        benign,
        true,
      ],
      [
        "rejects mail enablement change",
        benign + "update private.docked_mail_scheduler set enabled=false;",
        false,
      ],
      [
        "rejects mail request state change",
        benign +
          "update private.docked_mail_scheduler set last_request_id=123;",
        false,
      ],
      [
        "rejects backwards heartbeat",
        "update private.docked_mail_scheduler set last_tick_at=now()-interval '2 minutes';",
        false,
      ],
      [
        "rejects rewritten existing cron history",
        "update cron.job_run_details set status='failed' where runid=1;",
        false,
      ],
      [
        "rejects deleted existing weekly history",
        "delete from sports_feed.weekly_core_job_runs;",
        false,
      ],
      [
        "rejects a new cron command",
        benign +
          "update cron.job_run_details set command='select 2' where runid=2;",
        false,
      ],
      [
        "rejects a failed appended cron run",
        benign +
          "update cron.job_run_details set status='failed' where runid=2;",
        false,
      ],
      [
        "rejects new weekly issuance",
        benign +
          "update sports_feed.weekly_core_job_runs set issued=1 where id='00000000-0000-0000-0000-000000000002';",
        false,
      ],
      [
        "rejects new weekly failures",
        benign +
          "update sports_feed.weekly_core_job_runs set failures=1 where id='00000000-0000-0000-0000-000000000002';",
        false,
      ],
      [
        "rejects backdated appended weekly rows",
        benign +
          "update sports_feed.weekly_core_job_runs set started_at=now()-interval '2 minutes' where id='00000000-0000-0000-0000-000000000002';",
        false,
      ],
    ] as const;
    for (const [name, mutation, pass] of cases)
      await t.test(name, async () => {
        await db.exec("begin");
        try {
          await db.exec(mutation);
          const current = await captureInventoryScheduler(tx);
          const verify = () =>
            verifyInventorySchedulerDrift(
              tx,
              previous,
              current,
              previousTables,
            );
          if (pass)
            assert.deepEqual(await verify(), {
              cronRowsAdded: 1,
              weeklyZeroIssuanceRowsAdded: 1,
              mailTickAdvanced: true,
              existingHistoryUnchanged: true,
            });
          else await assert.rejects(verify);
        } finally {
          await db.exec("rollback");
        }
      });
  } finally {
    await db.close();
  }
});
