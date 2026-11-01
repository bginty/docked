/** Owner-approved TEST notification setup. No purchase or account admission. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";

async function mainTask() {
  const root = process.cwd();
  const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
  const dir = main + "/private-data/google-rtdn";
  const target = dir + "/worker-env.json";
  assert(process.argv.includes("--approved-notifications-20261101"));
  const credential = JSON.parse(
    readFileSync(
      join(
        process.env.USERPROFILE!,
        ".docked-secrets/google-play-test-verifier.json",
      ),
      "utf8",
    ),
  );
  assert.equal(
    credential.client_email,
    "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com",
  );
  const auth = JSON.parse(
    readFileSync(main + "/private-data/vercel-cli/auth.json", "utf8"),
  );
  const response = await fetch(
    "https://api.vercel.com/v13/deployments/docked.com.au?teamId=team_tf6xweKKyVCj9bTppUKttJ4l",
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(response.ok);
  const live = await response.json();
  assert.equal(
    live.projectId ?? live.project?.id,
    "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  );
  process.chdir(main);
  const sql = ownerDatabase();
  try {
    const [counts] =
      await sql`select (select count(*)::int from credits_sandbox.store_receipts) receipts,
    (select count(*)::int from credits_sandbox.store_test_admissions) admissions`;
    const [wallet] =
      await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
    const jobs =
      await sql`select jobid,jobname,active,schedule,md5(command) command_hash from cron.job order by jobid`;
    if (!existsSync(target)) {
      assert.equal(
        counts.receipts,
        0,
        "Existing receipts require original encryption/binding keys",
      );
      assert(
        !live.env.some((k: string) =>
          /^(DOCKED_STORE_|DOCKED_GOOGLE_|DOCKED_MEMBER_GOOGLE_TEST)/.test(k),
        ),
        "Recover existing runtime; do not replace security keys",
      );
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        target,
        JSON.stringify({
          DOCKED_STORE_REFERENCE_KEY: randomBytes(32).toString("hex"),
          DOCKED_STORE_ACCOUNT_BINDING_SECRET: randomBytes(32).toString("hex"),
          DOCKED_STORE_WORKER_SECRET: randomBytes(32).toString("hex"),
          DOCKED_GOOGLE_SERVICE_EMAIL: credential.client_email,
          DOCKED_GOOGLE_PRIVATE_KEY: credential.private_key,
          DOCKED_GOOGLE_PUSH_AUDIENCE:
            "https://docked.com.au/api/store/google/notifications",
          DOCKED_GOOGLE_PUSH_SERVICE_ACCOUNT:
            "docked-play-rtdn-push@docked-play-verification.iam.gserviceaccount.com",
          DOCKED_GOOGLE_PUSH_SUBSCRIPTION:
            "projects/docked-play-verification/subscriptions/docked-google-test-notifications-push",
          DOCKED_GOOGLE_RECONCILIATION_ENABLED: "true",
          DOCKED_MEMBER_GOOGLE_TEST: "false",
        }),
        { flag: "wx", mode: 0o600 },
      );
    }
    const prepared = JSON.parse(readFileSync(target, "utf8"));
    if (!prepared.CRON_SECRET) {
      assert(
        !live.env.includes("CRON_SECRET"),
        "Preserve existing scheduler secret",
      );
      prepared.CRON_SECRET = randomBytes(32).toString("hex");
      writeFileSync(target, JSON.stringify(prepared), { mode: 0o600 });
    }
    const evidence = {
      at: new Date().toISOString(),
      baseline: live.id,
      baselineCommit: live.meta.githubCommitSha,
      counts,
      wallet,
      jobs,
      privateRuntimePrepared: true,
      purchaseAdmissionChanged: false,
      schedulerActivated: false,
    };
    writeFileSync(
      resolve(
        root,
        "docs/qa/customer-billing-20261101/rtdn-runtime-prepared.json",
      ),
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end();
  }
}
mainTask().catch((error) => {
  writeFileSync(
    "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/rtdn-prepare-error.private.txt",
    String(error.stack),
    { mode: 0o600 },
  );
  console.error("RTDN preparation stopped; private diagnostic retained");
  process.exitCode = 1;
});
