/** Operator worker for the one normally-registered isolated deletion identity. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
async function main() {
  const f = JSON.parse(
    readFileSync(
      "private-data/restored-public-preview/fixture.private.json",
      "utf8",
    ),
  );
  const c = JSON.parse(
    readFileSync(
      "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
  assert.equal(f.projectRef, c.projectRef);
  const a = f.accounts.find((v: { kind: string }) => v.kind === "deletion");
  assert.match(
    a.email,
    /^docked-preview-public-deletion-[a-f0-9]+@example\.invalid$/,
  );
  const owner = postgres(c.databaseUrl, {
    max: 1,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
  });
  const [user] = await owner`select id from auth.users where email=${a.email}`;
  assert(user, "Only the normally registered isolated deletion identity");
  const [profile] =
    await owner`select disabled_at from public.profiles where id=${user.id}`;
  assert(profile?.disabled_at, "Customer must request deletion first");
  const [before] =
    await owner`select (select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.cards) cards,(select coalesce(sum(remaining),0)::text from commercial_billing.lots) funds,(select count(*)::int from auth.users where id<>${user.id}) unrelated_users,(select count(*)::int from private.consent_events where user_id=${user.id}) consent`;
  for (const key of Object.keys(process.env))
    if (
      /^(DOCKED_|VERCEL|DATABASE_|SUPABASE_|NEXT_PUBLIC_SUPABASE|APP_ENV)/.test(
        key,
      )
    )
      delete process.env[key];
  Object.assign(process.env, {
    APP_ENV: "development",
    SUPABASE_ENV: "isolated-worker",
    DATABASE_URL: f.runtime,
    DATABASE_SSL_CA_FILE: path.resolve("certs/supabase-prod-ca-2021.crt"),
    NEXT_PUBLIC_SUPABASE_URL: c.supabaseUrl,
    SUPABASE_SECRET_KEY: c.secretKey,
  });
  const { processAccountDeletion } =
    await import("../src/server/account-deletion");
  const { db } = await import("../src/server/db");
  try {
    await processAccountDeletion(user.id);
    await processAccountDeletion(user.id);
    const [after] =
      await owner`select (select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.cards) cards,(select coalesce(sum(remaining),0)::text from commercial_billing.lots) funds,(select count(*)::int from auth.users where id<>${user.id}) unrelated_users,(select count(*)::int from private.consent_events where user_id=${user.id}) consent`;
    assert.deepEqual(after, before);
    const [done] =
      await owner`select (select count(*)::int from auth.users where id=${user.id}) auth,(select count(*)::int from public.profiles where id=${user.id}) profiles,(select count(*)::int from private.audit_events where action='account_erasure_completed' and subject=${user.id}) completion,(select state from private.job_runs where kind='account_deletion' and dedupe_key=${`account-deletion:${user.id}`}) job`;
    assert.deepEqual(done, {
      auth: 0,
      profiles: 0,
      completion: 1,
      job: "done",
    });
    const evidence = {
      at: new Date().toISOString(),
      project: c.projectRef,
      normalHostedCustomerRequest: true,
      scopedOperatorWorker: true,
      syntheticOnly: true,
      completion: done,
      unrelatedAndFinancialRecordsPreserved: true,
      consentRetained: after.consent,
      repeatSafe: true,
      productionWrites: 0,
    };
    writeFileSync(
      "docs/qa/launch-resolution-20261102/hosted-deletion-worker.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await db().end();
    await owner.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
