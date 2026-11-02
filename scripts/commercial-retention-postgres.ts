import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { CommercialRetention } from "../src/server/commercial-retention";
import { CommercialReconciliation } from "../src/server/commercial-reconciliation";
import { CommercialLedger } from "../src/server/commercial-ledger";
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 8, onnotice: () => {} }),
  key = randomBytes(32),
  worker = new CommercialRetention(sql, key, "local");
const policy = "operational-retention-2026-11-02-v1",
  checks: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
};
async function main() {
  try {
    await sql.unsafe(
      "create role anon;create role authenticated;create role service_role;",
    );
    await sql.unsafe(
      await readFile(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    const migration = await readFile(
      "supabase/migrations/20261102011703_commercial_retention_controls.sql",
      "utf8",
    );
    await sql.unsafe(migration);
    await sql.unsafe(migration);
    const member = randomUUID(),
      receipt = "a".repeat(64);
    await sql`insert into commercial_billing.accounts values(${member},now())`;
    await sql`insert into commercial_billing.receipts(key,member_id,account_binding,environment,product,state,encrypted_reference) values(${receipt},${member},${"b".repeat(64)},'commercial','{}','REVOKED','fixture-encrypted-token')`;
    for (const id of [
      "eligible",
      "held",
      "receipt-held",
      "recovery",
      "pending",
      "recent",
      "active-lease",
    ])
      await sql`insert into commercial_billing.jobs(id,receipt,kind,state,attempts,last_error,completed_at,lease) values(${id},${["receipt-held", "recovery"].includes(id) ? receipt : null},'verify',${id === "pending" ? "pending" : "done"},4,'fixture diagnostics',${id === "recent" ? new Date() : new Date("2025-01-01")},${id === "active-lease" ? randomUUID() : null})`;
    await sql`insert into billing_retention.holds(scope,reference,case_reference,review_at) values('job','held','fixture-hold',now()-interval '1 day'),('receipt',${receipt},'fixture-receipt',now()+interval '1 day')`;
    const protectedBefore = (
      await sql`select md5(row_to_json(r)::text) hash from commercial_billing.receipts r`
    )[0].hash;
    await check(
      "dormant reapplication and dry run preserve source rows",
      async () => {
        assert.equal((await worker.run({ expectedPolicy: policy })).jobs, 1);
        await assert.rejects(
          worker.run({ expectedPolicy: policy, apply: true }),
          /activation required/,
        );
        assert.equal(
          (
            await sql`select attempts from commercial_billing.jobs where id='eligible'`
          )[0].attempts,
          4,
        );
      },
    );
    await sql`update billing_retention.policy set enabled=true,authority='isolated acceptance only',valid_until=now()+interval '1 day'`;
    await check("stale policy refuses mutation", async () => {
      await assert.rejects(
        worker.run({ expectedPolicy: "old", apply: true }),
        /policy changed/,
      );
    });
    await check(
      "concurrent workers minimize once, archive encrypted, retain dedup key",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 6 }, () =>
            worker.run({ expectedPolicy: policy, apply: true }),
          ),
        );
        assert.equal(
          results.reduce((n, r) => n + r.jobs, 0),
          1,
        );
        const [a] =
          await sql`select * from billing_retention.archives where job_id='eligible'`;
        assert.ok(!a.encrypted_payload.includes("fixture diagnostics"));
        assert.equal(
          worker.openArchive(a.encrypted_payload, "eligible", a.digest)
            .attempts,
          4,
        );
        assert.throws(() =>
          worker.openArchive(a.encrypted_payload, "wrong-job", a.digest),
        );
        assert.throws(() =>
          worker.openArchive(a.encrypted_payload, "eligible", "f".repeat(64)),
        );
        const [j] =
          await sql`select * from commercial_billing.jobs where id='eligible'`;
        assert.equal(j.state, "done");
        assert.equal(j.attempts, 0);
        assert.equal(j.last_error, null);
      },
    );
    await check(
      "Google notification duplicate remains rejected after minimization",
      async () => {
        const ledger = new CommercialLedger(sql, "commercial", {
          active: "local",
          values: { local: key },
        });
        const reconcile = new CommercialReconciliation(
          ledger,
          {
            verify: async () => {
              throw Error("not called");
            },
            consume: async () => {},
          },
          async () => true,
        );
        const id = "c".repeat(64);
        await sql`insert into commercial_billing.jobs(id,kind,state,completed_at) values(${"push:" + id},'test','done','2025-01-01')`;
        await worker.run({ expectedPolicy: policy, apply: true });
        assert.equal(
          await reconcile.enqueue({
            id,
            receiptKey: null,
            kind: "test",
          } as Parameters<typeof reconcile.enqueue>[0]),
          false,
        );
      },
    );
    await check(
      "overdue holds and unresolved recovery prevent cleanup",
      async () => {
        await sql`update billing_retention.holds set released_at=now() where scope='receipt'`;
        await sql`insert into commercial_billing.recovery_cases(id,receipt,member_id,exposure_credits,reason) values('case',${receipt},${member},700,'fixture')`;
        assert.equal(
          (await worker.run({ expectedPolicy: policy, apply: true })).jobs,
          0,
        );
        assert.ok(
          (await worker.run({ expectedPolicy: policy })).holds.overdue > 0,
        );
      },
    );
    await check(
      "encrypted archives expire only without a hold; evidence remains",
      async () => {
        await sql`update billing_retention.archives set expires_at=now()-interval '1 second'`;
        await sql`insert into billing_retention.holds(scope,reference,case_reference,review_at) values('job','eligible','archive-hold',now()+interval '1 day')`;
        assert.equal(
          (await worker.run({ expectedPolicy: policy, apply: true })).archives,
          1,
        );
        assert.equal(
          (await sql`select count(*)::int n from billing_retention.archives`)[0]
            .n,
          1,
        );
        await sql`update billing_retention.holds set released_at=now() where reference='eligible'`;
        assert.equal(
          (await worker.run({ expectedPolicy: policy, apply: true })).archives,
          1,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from billing_retention.tombstones`
          )[0].n,
          2,
        );
        assert.equal(
          (
            await sql`select state from commercial_billing.jobs where id='eligible'`
          )[0].state,
          "done",
        );
      },
    );
    await check(
      "financial records and encrypted purchase reference unchanged",
      async () => {
        assert.equal(
          (
            await sql`select md5(row_to_json(r)::text) hash from commercial_billing.receipts r`
          )[0].hash,
          protectedBefore,
        );
      },
    );
    await check(
      "worker cannot grant funds, activate policy, read Auth, or erase audit",
      async () => {
        for (const query of [
          "update commercial_billing.products set approved=true",
          "delete from commercial_billing.receipts",
          "update billing_retention.policy set enabled=true",
          "delete from billing_retention.audit",
        ])
          await assert.rejects(
            sql.begin(async (tx) => {
              await tx.unsafe("set local role docked_retention_worker");
              await tx.unsafe(query);
            }),
          );
        await assert.rejects(
          sql.begin(async (tx) => {
            await tx.unsafe("set local role authenticated");
            await tx.unsafe("select * from billing_retention.archives");
          }),
        );
      },
    );
    await check(
      "restricted worker executes with RLS and no bypass",
      async () => {
        await sql`insert into commercial_billing.jobs(id,kind,state,completed_at) values('restricted','test','done','2025-01-01')`;
        await sql.begin(async (tx) => {
          await tx.unsafe("set local role docked_retention_worker");
          // Nested begin uses a savepoint through postgres transaction connection.
          const restricted = new CommercialRetention(
            tx as unknown as postgres.Sql,
            key,
            "local",
          );
          // Use a dedicated connection for the actual public API below; SQL read guard here.
          void restricted;
          assert.equal(
            (
              await tx`select count(*)::int n from billing_retention.candidates(100)`
            )[0].n,
            1,
          );
        });
        await sql`create role retention_fixture login password 'isolated-only' in role docked_retention_worker`;
        const restrictedUrl = new URL(url);
        restrictedUrl.username = "retention_fixture";
        restrictedUrl.password = "isolated-only";
        const connection = postgres(restrictedUrl.href, {
          max: 1,
          onnotice: () => {},
        });
        try {
          assert.equal(
            (
              await new CommercialRetention(connection, key, "local").run({
                expectedPolicy: policy,
                apply: true,
              })
            ).jobs,
            1,
          );
        } finally {
          await connection.end();
        }
      },
    );
    await check(
      "failed archive write rolls back minimization and audit",
      async () => {
        await sql`insert into commercial_billing.jobs(id,kind,state,completed_at,last_error) values('atomic','test','done','2025-01-01','retain until committed')`;
        await sql.unsafe(
          "create function billing_retention.fixture_failure() returns trigger language plpgsql as $$begin raise exception 'isolated archive failure';end$$;create trigger fixture_failure before insert on billing_retention.archives for each row execute function billing_retention.fixture_failure()",
        );
        await assert.rejects(
          worker.run({ expectedPolicy: policy, apply: true }),
          /isolated archive failure/,
        );
        assert.equal(
          (
            await sql`select last_error from commercial_billing.jobs where id='atomic'`
          )[0].last_error,
          "retain until committed",
        );
        assert.equal(
          (
            await sql`select count(*)::int n from billing_retention.tombstones where job_id='atomic'`
          )[0].n,
          0,
        );
        await sql.unsafe(
          "drop trigger fixture_failure on billing_retention.archives",
        );
      },
    );
    await check(
      "hold insertion serializes with cleanup and never silently expires",
      async () => {
        let acquired!: () => void, release!: () => void;
        const ready = new Promise<void>((r) => {
            acquired = r;
          }),
          gate = new Promise<void>((r) => {
            release = r;
          });
        const hold = sql.begin(async (tx) => {
          await tx`insert into billing_retention.holds(scope,reference,case_reference,review_at)values('job','atomic','concurrent-case',now()-interval '1 day')`;
          acquired();
          await gate;
        });
        await ready;
        const cleanup = worker.run({ expectedPolicy: policy, apply: true });
        release();
        await hold;
        assert.equal((await cleanup).jobs, 0);
        assert.equal(
          (
            await sql`select last_error from commercial_billing.jobs where id='atomic'`
          )[0].last_error,
          "retain until committed",
        );
      },
    );
    await check("expired policy and global holds fail closed", async () => {
      await sql`insert into commercial_billing.jobs(id,kind,state,completed_at) values('global','test','done','2025-01-01')`;
      await sql`insert into billing_retention.holds(scope,reference,case_reference,review_at) values('all','*','global-case',now())`;
      assert.equal((await worker.run({ expectedPolicy: policy })).jobs, 0);
      await sql`update billing_retention.policy set valid_until=now()-interval '1 second'`;
      await assert.rejects(
        worker.run({ expectedPolicy: policy, apply: true }),
        /activation required/,
      );
    });
    await mkdir("docs/qa/launch-resolution-20261102", { recursive: true });
    await writeFile(
      "docs/qa/launch-resolution-20261102/retention-postgres.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          engine: "PostgreSQL 17 isolated loopback",
          checks,
          passed: checks.length,
          productionMutation: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Retention acceptance failed; see isolated assertion");
  process.exitCode = 1;
});
