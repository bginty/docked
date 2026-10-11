import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const evidence = JSON.parse(
  readFileSync("docs/qa/nfl-member/worker-hosted.json", "utf8"),
);
assert.equal(evidence.unauthorised, 401);
assert.equal(evidence.missingWorkerToken, 403);
assert.ok(evidence.tasks.every((t) => t.status === 200));
const { token } = JSON.parse(
  readFileSync("private-data/nfl-worker/secrets.json", "utf8"),
);
const { anon } = JSON.parse(
  readFileSync("private-data/nfl-worker/anon.json", "utf8"),
);
const sql = ownerDatabase();
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(
      "create extension if not exists pg_net with schema extensions",
    );
    for (const [name, value] of [
      ["docked_nfl_worker_token", token],
      ["docked_nfl_worker_anon", anon],
    ]) {
      const [secret] =
        await tx`select id from vault.secrets where name=${name}`;
      if (!secret)
        await tx`select vault.create_secret(${value},${name},'Docked isolated free NFL collector only')`;
    }
    for (const [task, schedule] of [
      ["weekly", "5 0,12 * * *"],
      ["pbp", "10 0,12 * * *"],
      ["rosters", "15 0,12 * * *"],
      ["reconcile", "*/15 * * * *"],
    ]) {
      const command = `select net.http_post(url:='https://${projectRef}.supabase.co/functions/v1/nfl-postgame?task=${task}',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='docked_nfl_worker_anon'),'x-docked-worker',(select decrypted_secret from vault.decrypted_secrets where name='docked_nfl_worker_token'),'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=145000);`;
      await tx`select cron.schedule(${"docked-nfl-" + task},${schedule},${command})`;
    }
    await tx`select cron.schedule('docked-nfl-lineup-lock','* * * * *','select sports_feed.nfl_lock_due()')`;
  });
  const jobs =
    await sql`select jobname,schedule,active from cron.job where jobname like 'docked-nfl-%' order by jobname`;
  writeFileSync(
    "docs/qa/nfl-member/scheduler.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectRef,
        jobs,
        timezone: "UTC",
        sourceRequests: "at most one per dataset per 12 hours",
        authentication: "platform JWT plus Vault-held dedicated token",
        externalAdmission: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(jobs);
} finally {
  await sql.end();
}
