import assert from "node:assert/strict";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import postgres from "postgres";
import { initialCredits } from "../src/core/credits-sandbox";

async function main() {
  const url = new URL(
    process.env.FANTASY_TEST_DATABASE_URL ?? "https://invalid",
  );
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/docked_free_play_test_\d+$/);
  const sql = postgres(url.href, { max: 2, onnotice: () => {} });
  const checks: string[] = [],
    failures: string[] = [];
  let authCalls = 0,
    authFail = true;
  let concurrentAuthRequests = 0;
  const authWaiters: Array<() => void> = [];
  const user = randomUUID(),
    other = randomUUID();
  const auth = createServer(async (req, res) => {
    // Match the SDK's versioned error contract, including user_not_found.
    res.setHeader("x-supabase-api-version", "2024-01-01");
    if (
      req.method !== "DELETE" ||
      req.url !== `/auth/v1/admin/users/${user}` ||
      req.headers.apikey !== "synthetic-local-auth"
    ) {
      res.writeHead(403);
      res.end("{}");
      return;
    }
    authCalls++;
    if (authFail) {
      res.writeHead(503);
      res.end('{"message":"Isolated provider outage"}');
      return;
    }
    try {
      // All four workers must pass the pending-job read before Auth completes.
      concurrentAuthRequests++;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(Error("Concurrent Auth barrier timed out")),
          10_000,
        );
        authWaiters.push(() => {
          clearTimeout(timeout);
          resolve();
        });
        if (authWaiters.length === 4)
          for (const release of authWaiters) release();
      });
      const removed =
        await sql`delete from auth.users where id=${user} returning id`;
      if (!removed.length) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(
          '{"code":"user_not_found","message":"Synthetic identity already erased"}',
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: user }));
    } catch (error) {
      const constraint =
        (error as { constraint_name?: string }).constraint_name ??
        "unidentified";
      failures.push(
        `Auth identity delete blocked by application constraint: ${constraint}`,
      );
      res.writeHead(500);
      res.end('{"message":"Isolated database delete failed"}');
    }
  });
  try {
    await sql.unsafe(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated;
      create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,hash text not null);`);
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const pending = files.filter((f) =>
      /^(20261031123611|20261031123931|20261031234304)_/.test(f),
    );
    assert.equal(pending.length, 3);
    const apply = async (file: string) =>
      sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(684210)`;
        const version = file.split("_")[0],
          source = readFileSync(`supabase/migrations/${file}`, "utf8");
        const hash = createHash("sha256").update(source).digest("hex");
        const [existing] =
          await tx`select hash from supabase_migrations.schema_migrations where version=${version}`;
        if (existing) {
          assert.equal(existing.hash, hash, "Applied migration drift");
          return false;
        }
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations values(${version},${hash})`;
        return true;
      });
    for (const file of files.filter((f) => !pending.includes(f)))
      await apply(file);
    await sql`insert into auth.users(id,email_confirmed_at) values(${user},now()),(${other},now())`;
    await sql`insert into public.profiles(id,country,state,accepted_version) values(${user},'XX','TEST','isolated'),(${other},'XX','TEST','isolated')`;
    await sql`insert into auth.sessions values(${randomUUID()},${user},null),(${randomUUID()},${other},null)`;
    const social = randomUUID();
    await sql`insert into private.social_profiles(id,user_id,handle,display_name,bio) values(${social},${user},'isolatedmember','Synthetic member','Disposable biography')`;
    await sql`insert into private.social_posts(author_id,kind,body,sport) values(${social},'discussion','Synthetic content for erasure','nfl')`;
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initialCredits() as any)}) on conflict(id) do nothing`;
    const tables =
      await sql`select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','private','auth','credits_sandbox','beta_fantasy','sports_feed') order by 1,2`;
    const fingerprint = async () => {
      const result: Record<string, string> = {};
      for (const t of tables) {
        const [r] = await sql.unsafe(
          `select md5(coalesce(string_agg(row_to_json(t)::text,E'\n' order by row_to_json(t)::text),'')) hash from "${t.table_schema}"."${t.table_name}" t`,
        );
        result[`${t.table_schema}.${t.table_name}`] = r.hash;
      }
      return result;
    };
    const before = await fingerprint();
    // Demonstrate transactional recovery before recording either migration.
    await assert.rejects(
      sql.begin(async (tx) => {
        for (const file of pending)
          await tx.unsafe(readFileSync(`supabase/migrations/${file}`, "utf8"));
        throw Error("Intentional isolated rollback");
      }),
      /Intentional isolated rollback/,
    );
    assert.deepEqual(await fingerprint(), before);
    assert.equal(
      (
        await sql`select to_regclass('sports_feed.free_core_programmes') object`
      )[0].object,
      null,
    );
    checks.push(
      "Three launch migrations roll back transactionally without changing pre-existing rows",
    );
    for (const file of pending) assert.equal(await apply(file), true);
    assert.deepEqual(await fingerprint(), before);
    checks.push(
      `Three launch migrations preserve all ${tables.length} existing table fingerprints`,
    );
    for (const file of pending) assert.equal(await apply(file), false);
    checks.push(
      "Version/hash history skips a repeated migration run without duplicate DDL",
    );
    assert.equal(
      (
        await sql`select count(*)::int n from sports_feed.free_core_programmes where enabled`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from credits_sandbox.store_test_admissions`
      )[0].n,
      0,
    );
    checks.push(
      "Free Core remains disabled; store admission and receipt tables start empty",
    );

    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_app",
    ]) {
      assert.equal(
        (
          await sql`select has_table_privilege(${role},'credits_sandbox.store_notifications','SELECT') allowed`
        )[0].allowed,
        false,
      );
      assert.equal(
        (
          await sql`select has_table_privilege(${role},'credits_sandbox.store_notifications','INSERT') allowed`
        )[0].allowed,
        false,
      );
    }
    await sql.begin(async (tx) => {
      await tx`set local role docked_beta_app`;
      await tx`insert into credits_sandbox.store_notifications(id,kind,occurred_at) values('synthetic-queue-test','test',1) on conflict do nothing`;
      await tx`insert into credits_sandbox.store_notifications(id,kind,occurred_at) values('synthetic-queue-test','test',1) on conflict do nothing`;
      assert.equal(
        (
          await tx`select count(*)::int n from credits_sandbox.store_notifications`
        )[0].n,
        1,
      );
    });
    assert.deepEqual(await fingerprint(), before);
    checks.push(
      "Notification queue enforces runtime-only RLS/grants and deduplicates without changing customer data",
    );

    const password = randomBytes(24).toString("hex");
    await sql.unsafe(`alter role docked_app login password '${password}'`);
    const runtime = new URL(url);
    runtime.username = "docked_app";
    runtime.password = password;
    await new Promise<void>((resolve) => auth.listen(0, "127.0.0.1", resolve));
    const address = auth.address();
    assert(address && typeof address !== "string");
    const run = async (beta = false) =>
      new Promise<{ code: number; output: string }>((resolve, reject) => {
        const p = spawn(
          process.execPath,
          [
            "--conditions=react-server",
            "--import",
            "tsx",
            "scripts/public-deletion-worker.ts",
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              NODE_ENV: "test",
              DATABASE_URL: runtime.href,
              DOCKED_BETA_STAGING: beta ? "true" : "false",
              DOCKED_HOSTED_PRODUCTION: "false",
              DOCKED_HOSTED_PREVIEW: "false",
              NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
              SUPABASE_SECRET_KEY: "synthetic-local-auth",
              DELETION_FIXTURE_USER: user,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        p.stdout.on("data", (b) => (output += b));
        p.stderr.on("data", (b) => (output += b));
        p.on("error", reject);
        p.on("close", (code) =>
          resolve({
            code: code ?? 1,
            output: output.replaceAll(password, "[redacted]"),
          }),
        );
      });
    let result = await run();
    assert.notEqual(result.code, 0, result.output);
    assert.match(result.output, /Account must be disabled before erasure/);
    assert.equal(authCalls, 0);
    checks.push(
      "Public deletion refuses an active account before any Auth request",
    );
    await sql`select private.disable_account(${user})`;
    assert.equal(
      (
        await sql`select status from private.social_profiles where id=${social}`
      )[0].status,
      "deleted",
    );
    assert.equal(
      (
        await sql`select body from private.social_posts where author_id=${social}`
      )[0].body,
      "",
    );
    checks.push(
      "Access revocation removes eligible social identity and authored content",
    );
    const survivor = (
      await sql`select row_to_json(p) value from public.profiles p where id=${other}`
    )[0].value;
    await sql`insert into credits_sandbox.store_test_admissions values(${user},'isolated',false,now()+interval '1 hour','[{"id":"synthetic"}]','Isolated expiry and account deletion acceptance only')`;
    result = await run();
    assert.notEqual(result.code, 0, result.output);
    assert.equal(authCalls, 1, result.output);
    assert.equal(
      (
        await sql`select count(*)::int n from auth.sessions where user_id=${user}`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from private.job_runs where kind='account_deletion' and payload->>'userId'=${user}`
      )[0].n,
      1,
    );
    checks.push(
      "Auth outage retains one queued erasure and already revokes account sessions",
    );
    authFail = false;
    const retries = await Promise.all(Array.from({ length: 4 }, () => run()));
    for (const retry of retries) assert.equal(retry.code, 0, retry.output);
    assert.equal(concurrentAuthRequests, 4);
    checks.push(
      "Four concurrent erasure retries converge on one completion audit",
    );
    assert.equal(
      (await sql`select count(*)::int n from auth.users where id=${user}`)[0].n,
      0,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from public.profiles where id=${user}`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await sql`select count(*)::int n from credits_sandbox.store_test_admissions where user_id=${user}`
      )[0].n,
      0,
    );
    assert.deepEqual(
      (
        await sql`select row_to_json(p) value from public.profiles p where id=${other}`
      )[0].value,
      survivor,
    );
    checks.push(
      "Public-mode retry erases synthetic Auth/profile/admission; unrelated member preserved",
    );
    assert.equal(
      (
        await sql`select count(*)::int n from private.job_runs where kind='account_deletion' and payload->>'userId'=${user}`
      )[0].n,
      0,
    );
    checks.push("Erasure audit retained and queued identity payload scrubbed");
    assert.equal(
      (
        await sql`select state from private.job_runs where dedupe_key=${`account-deletion:${user}`}`
      )[0].state,
      "done",
    );
    const callsBeforeRetry = authCalls;
    result = await run();
    assert.equal(result.code, 0, result.output);
    assert.equal(authCalls, callsBeforeRetry);
    assert.equal(
      (
        await sql`select count(*)::int n from private.audit_events where subject=${user} and action='account_erasure_completed'`
      )[0].n,
      1,
    );
    assert.equal(
      (await fingerprint())["credits_sandbox.state"],
      before["credits_sandbox.state"],
    );
    checks.push(
      "Repeat completion is safe without restoring identity or changing other accounts",
    );
  } finally {
    auth.closeAllConnections();
    await new Promise<void>((r) => auth.close(() => r()));
    await sql.end();
    mkdirSync("docs/qa/customer-billing-20261101", { recursive: true });
    writeFileSync(
      "docs/qa/customer-billing-20261101/isolated-migrations-deletion.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          checks,
          failures,
          authCalls,
          concurrentAuthRequests,
          scope:
            "Disposable PostgreSQL; actual public deletion service and runtime role; loopback mocked Supabase Auth transport; no hosted/customer connection",
        },
        null,
        2,
      ) + "\n",
    );
  }
  console.log(JSON.stringify({ passed: checks.length, checks }));
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Isolated acceptance failed",
  );
  process.exitCode = 1;
});
