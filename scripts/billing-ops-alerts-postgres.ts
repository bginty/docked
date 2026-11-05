/** Disposable loopback PostgreSQL only. No provider call, hosted account, email,
 * secret loading, production SQL or scheduler action is permitted here. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import {
  dispatchBillingOpsAlert,
  billingOpsAlertMessage,
} from "../src/server/billing-ops-alerts.mjs";
import { billingOpsQueueRpc } from "../src/server/billing-ops-queue.mjs";
import { leaseOutboxRecord } from "../src/server/outbox-lease";

const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.toString(), { max: 16, onnotice: () => {} });
const prepared = readFileSync(
  "config/operations/billing-ops-outbox.prepared.sql",
  "utf8",
);
async function applyPackage(source = prepared) {
  const reserved = await sql.reserve();
  try {
    await reserved.unsafe(source);
  } catch (error) {
    await reserved.unsafe("rollback");
    throw error;
  } finally {
    reserved.release();
  }
}
const checks: string[] = [];
const env = {
  DOCKED_BILLING_OPS_ALERTS: "true",
  SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-no-provider-access",
  DOCKED_GRAPH_MAIL_ENABLED: "true",
  DOCKED_BILLING_OPS_RECIPIENT: "support@docked.com.au",
  DOCKED_BILLING_OPS_AUTHORITY:
    "isolated PostgreSQL operational adapter test only",
  DOCKED_BILLING_OPS_UNTIL: new Date(Date.now() + 86400000).toISOString(),
};
type Role =
  | "anon"
  | "authenticated"
  | "service_role"
  | "docked_app"
  | "docked_commercial_app";
async function as<T>(role: Role, run: (tx: Sql) => Promise<T>) {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role " + role);
    return run(tx as unknown as Sql);
  }) as Promise<T>;
}
const enqueue = () =>
  as(
    "docked_commercial_app",
    async (tx) =>
      (await tx`select public.docked_billing_ops_enqueue() id`)[0].id as
        string | null,
  );
const rpc = (action: string, data: Record<string, unknown>) =>
  as(
    "service_role",
    async (tx) =>
      (
        await tx`select public.docked_billing_ops_queue(${action},${tx.json(data as never)}) r`
      )[0].r,
  );
const count = async () =>
  Number(
    (
      await sql`select count(*) n from private.outbox where payload->>'purpose'='billing_ops_health_v1'`
    )[0].n,
  );
const health = {
  commercialAttention: 0,
  commercialOverdue: 0,
  openRecoveryCases: 0,
  testAttention: 7,
  testOverdue: 0,
  authMailFailures: 0,
  authMailPending: 0,
  authMailOverdue: 0,
};
async function approve() {
  await sql`update commercial_billing.control set approvals=jsonb_set(approvals,'{opsAlerts}',${sql.json({ version: "billing-ops-policy-v1", purpose: "billing_ops_health_v1", recipient: "support@docked.com.au", authority: "isolated fixture, not production approval", validUntil: env.DOCKED_BILLING_OPS_UNTIL })},true) where id`;
  await sql`update private.feature_flags set enabled=true where key='billing_ops_alerts'`;
}
async function clean() {
  await sql`delete from private.outbox where payload->>'purpose'='billing_ops_health_v1'`;
  await approve();
}
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
  console.log("PASS " + name);
}
const row = async (id: string) =>
  (await sql`select * from private.outbox where id=${id}`)[0];
const body = (r: Awaited<ReturnType<typeof row>>) =>
  billingOpsAlertMessage(r.payload.health, r.payload.observedAt)!;
function queue() {
  return billingOpsQueueRpc(env, async (address, options) => {
    assert.equal(
      address,
      env.SUPABASE_URL + "/rest/v1/rpc/docked_billing_ops_queue",
    );
    assert.equal(options?.redirect, "error");
    const request = JSON.parse(String(options?.body));
    return Response.json(await rpc(request.p_action, request.p_data));
  });
}
async function protectedHash() {
  return (
    await sql`select md5(jsonb_build_object('mail',(select jsonb_agg(t order by id) from private.docked_auth_mail_outbox t),'accounts',(select jsonb_agg(t order by member_id) from commercial_billing.accounts t),'receipts',(select jsonb_agg(t order by key) from commercial_billing.receipts t),'jobs',(select jsonb_agg(t order by id) from commercial_billing.jobs t),'cases',(select jsonb_agg(t order by id) from commercial_billing.recovery_cases t),'cards',(select jsonb_agg(t order by id) from commercial_billing.cards t),'lots',(select jsonb_agg(t order by id) from commercial_billing.lots t),'testHints',(select jsonb_agg(t order by id) from credits_sandbox.store_notifications t))::text) hash`
  )[0].hash;
}
async function main() {
  try {
    await sql.unsafe(
      "create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create schema private;create schema credits_sandbox;revoke all on schema private from public;",
    );
    const platform = readFileSync(
      "supabase/migrations/20261002113546_docked_platform.sql",
      "utf8",
    );
    for (const name of ["outbox", "feature_flags", "audit_events"])
      await sql.unsafe(
        platform.match(
          new RegExp(`create table private\\.${name}\\([^;]+;`),
        )![0],
      );
    await sql.unsafe(
      "alter table private.outbox enable row level security;grant usage on schema private to docked_app;grant select,insert,update on private.outbox to docked_app;create policy normal_read on private.outbox for select to docked_app using(true);create policy normal_insert on private.outbox for insert to docked_app with check(kind in('service','education') and state='queued');create policy normal_update on private.outbox for update to docked_app using(true) with check(state in('suppressed','dead'));",
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261031234304_google_test_reconciliation_queue.sql",
        "utf8",
      ),
    );
    await sql.unsafe(
      readFileSync(
        "config/production-email/supabase/migrations/20261008121711_docked_auth_email_outbox.sql",
        "utf8",
      ),
    );
    for (let i = 0; i < 7; i++)
      await sql`insert into credits_sandbox.store_notifications(id,kind,occurred_at,state,attempts)values(${`isolated-unbound-hint-${i}`},'purchase',0,'attention',12)`;
    await sql`insert into private.docked_auth_mail_outbox(id,fingerprint,mode,envelope,state)values(${"a".repeat(64)},${"b".repeat(64)},'production',null,'accepted')`;
    await sql`insert into private.outbox(dedupe_key,kind,payload,expires_at)values('legacy-service','service','{}',clock_timestamp()+interval '1 day'),('legacy-null-purpose','service','{"purpose":null}',clock_timestamp()+interval '1 day')`;
    const legacyBefore = (
      await sql`select md5(jsonb_agg(t order by id)::text) h from private.outbox t`
    )[0].h;
    const protectedBefore = await protectedHash();
    await check(
      "first-apply collisions and nullable dedupe schema fail without hiding customer records",
      async () => {
        const reserved = await sql.reserve();
        try {
          await reserved`insert into private.outbox(dedupe_key,kind,payload,expires_at)values('billing-ops-v1:existing-customer-record','service','{"legitimate":"existing service"}',clock_timestamp()+interval '1 day')`;
          await assert.rejects(
            reserved.unsafe(prepared),
            /purpose\/prefix collision/,
          );
          await reserved.unsafe("rollback");
          assert.equal(
            (
              await reserved`select count(*)::int n from private.outbox where dedupe_key='billing-ops-v1:existing-customer-record'`
            )[0].n,
            1,
          );
          await reserved`delete from private.outbox where dedupe_key='billing-ops-v1:existing-customer-record'`;
          await reserved.unsafe(
            "alter table private.outbox alter column dedupe_key drop not null",
          );
          await assert.rejects(
            reserved.unsafe(prepared),
            /dedupe_key NOT NULL/,
          );
          await reserved.unsafe("rollback");
          await reserved.unsafe(
            "alter table private.outbox alter column dedupe_key set not null",
          );
        } finally {
          reserved.release();
        }
      },
    );
    await applyPackage();
    await check(
      "prepared SQL is dormant, idempotent and preserves existing records",
      async () => {
        assert.equal(await enqueue(), null);
        assert.equal(await rpc("claim", { worker: randomUUID() }), null);
        assert.equal(await count(), 0);
        await applyPackage();
        assert.equal(
          (
            await sql`select md5(jsonb_agg(t order by id)::text) h from private.outbox t`
          )[0].h,
          legacyBefore,
        );
        assert.equal(await protectedHash(), protectedBefore);
        assert.equal(
          (
            await sql`select enabled from private.feature_flags where key='billing_ops_alerts'`
          )[0].enabled,
          false,
        );
      },
    );
    await check(
      "actual DB grants deny public/app callers and forged role claims",
      async () => {
        for (const role of [
          "anon",
          "authenticated",
          "docked_app",
          "docked_commercial_app",
        ] as Role[])
          await assert.rejects(
            as(role, async (tx) => {
              await tx`select set_config('request.jwt.claim.role','service_role',true)`;
              await tx`select public.docked_billing_ops_queue('claim',${tx.json({ worker: randomUUID() })})`;
            }),
            /permission denied/,
          );
        await assert.rejects(
          as("service_role", (tx) => tx`select * from private.outbox`),
          /permission denied/,
        );
        await assert.rejects(
          as("docked_commercial_app", (tx) => tx`select * from private.outbox`),
          /permission denied/,
        );
        await assert.rejects(
          as(
            "docked_app",
            (tx) => tx`select public.docked_billing_ops_enqueue()`,
          ),
          /permission denied/,
        );
        assert.equal(
          (
            await sql`select has_schema_privilege('docked_commercial_app','private','usage') allowed`
          )[0].allowed,
          false,
        );
      },
    );
    await check(
      "DB policy window cannot be replaced by a runtime flag",
      async () => {
        await sql`update private.feature_flags set enabled=true where key='billing_ops_alerts'`;
        assert.equal(await enqueue(), null);
        assert.equal(await rpc("claim", { worker: randomUUID() }), null);
        await approve();
        await sql`update commercial_billing.control set approvals=jsonb_set(approvals,'{opsAlerts,validUntil}','"2020-01-01T00:00:00Z"') where id`;
        assert.equal(await enqueue(), null);
        await approve();
      },
    );
    await check(
      "24 concurrent producers persist one server-derived aggregate and audit event",
      async () => {
        const ids = await Promise.all(Array.from({ length: 24 }, enqueue));
        assert.equal(new Set(ids).size, 1);
        assert.equal(await count(), 1);
        const saved = await row(ids[0]!);
        assert.deepEqual(saved.payload.health, health);
        assert.equal(saved.user_id, null);
        assert.equal(saved.dedupe_key, body(saved).key);
        assert.equal(
          (
            await sql`select count(*)::int n from private.audit_events where action='billing_ops_enqueued'`
          )[0].n,
          1,
        );
      },
    );
    await check(
      "ordinary outbox reads/inserts/suppression and generic leasing remain correct",
      async () => {
        const ops = (
          await sql`select id from private.outbox where payload->>'purpose'='billing_ops_health_v1'`
        )[0].id;
        assert.equal(
          (
            await as(
              "docked_app",
              (tx) => tx`select count(*)::int n from private.outbox`,
            )
          )[0].n,
          2,
        );
        await assert.rejects(
          as(
            "docked_app",
            (tx) =>
              tx`insert into private.outbox(dedupe_key,kind,payload,expires_at)values('spoof-purpose','service','{"purpose":"billing_ops_health_v1"}',clock_timestamp()+interval '1 hour')`,
          ),
          /row-level security/,
        );
        await assert.rejects(
          as(
            "docked_app",
            (tx) =>
              tx`insert into private.outbox(dedupe_key,kind,payload,expires_at)values('billing-ops-v1:spoof','service','{}',clock_timestamp()+interval '1 hour')`,
          ),
          /row-level security/,
        );
        assert.equal(
          (
            await as(
              "docked_app",
              (tx) =>
                tx`update private.outbox set state='dead' where id=${ops} returning id`,
            )
          ).length,
          0,
        );
        await sql`update private.outbox set created_at=clock_timestamp()-interval '1 day' where id=${ops}`;
        assert.equal(await leaseOutboxRecord(sql, ops), null);
        const leased = await leaseOutboxRecord(sql);
        assert(leased);
        assert.notEqual(leased.id, ops);
        await as(
          "docked_app",
          (tx) =>
            tx`update private.outbox set state='suppressed' where id=${leased.id}`,
        );
        assert.equal((await row(leased.id)).state, "suppressed");
        await assert.rejects(
          as(
            "docked_app",
            (tx) =>
              tx`update private.outbox set state='dead',payload='{"purpose":"billing_ops_health_v1"}' where id=${leased.id}`,
          ),
          /row-level security/,
        );
      },
    );
    await check(
      "24 real claims and duplicate fences produce one dispatch owner",
      async () => {
        const workers = Array.from({ length: 24 }, () => randomUUID());
        const claims = await Promise.all(
          workers.map((worker) => rpc("claim", { worker })),
        );
        assert.equal(claims.filter(Boolean).length, 1);
        const job = claims.find(Boolean)!;
        const key = body(await row(job.id)).key;
        await assert.rejects(
          rpc("fence", { id: job.id, worker: randomUUID(), key }),
          /lease unavailable/,
        );
        await assert.rejects(
          rpc("fence", { id: job.id, worker: job.lease, key: "wrong" }),
          /dispatch denied/,
        );
        const results = await Promise.all(
          Array.from({ length: 12 }, () =>
            rpc("fence", { id: job.id, worker: job.lease, key }),
          ),
        );
        assert.equal(results.filter((r) => r.fenced).length, 1);
        await assert.rejects(
          rpc("settle", { id: job.id, worker: job.lease, outcome: "healthy" }),
          /transition/,
        );
        await rpc("settle", {
          id: job.id,
          worker: job.lease,
          outcome: "accepted",
        });
        await rpc("settle", {
          id: job.id,
          worker: job.lease,
          outcome: "accepted",
        });
        assert.equal((await row(job.id)).state, "sent");
        assert.equal(
          (
            await sql`select count(*)::int n from private.audit_events where subject=${job.id} and action='billing_ops_settled'`
          )[0].n,
          1,
        );
      },
    );
    await check(
      "unfenced lease can recover; stale owner and post-fence retry are denied",
      async () => {
        await clean();
        const id = (await enqueue())!;
        const first = await rpc("claim", { worker: randomUUID() });
        await sql`update private.outbox set lease_until=clock_timestamp()-interval '1 second' where id=${id}`;
        const second = await rpc("claim", { worker: randomUUID() });
        assert.equal(second.id, first.id);
        assert.notEqual(second.lease, first.lease);
        const key = body(await row(id)).key;
        await assert.rejects(
          rpc("fence", { id, worker: first.lease, key }),
          /lease unavailable/,
        );
        await rpc("fence", { id, worker: second.lease, key });
        await sql`update private.outbox set lease_until=clock_timestamp()-interval '1 second' where id=${id}`;
        assert.equal(await rpc("claim", { worker: randomUUID() }), null);
        assert.equal((await row(id)).state, "dead");
        assert.equal((await row(id)).payload.outcome, "unknown");
        await assert.rejects(
          rpc("settle", { id, worker: first.lease, outcome: "accepted" }),
          /lease unavailable/,
        );
      },
    );
    await check(
      "real adapter fences before mocked Graph acceptance; outage cannot resend",
      async () => {
        await clean();
        const id = (await enqueue())!;
        let calls = 0;
        const sender = async () => {
          calls++;
          assert.equal((await row(id)).payload.phase, "dispatching");
        };
        assert.equal(
          (await dispatchBillingOpsAlert(queue(), env, { send: sender }))
            .status,
          "accepted",
        );
        assert.equal(
          (await dispatchBillingOpsAlert(queue(), env, { send: sender }))
            .status,
          "empty",
        );
        assert.equal(calls, 1);
        await clean();
        const uncertain = (await enqueue())!;
        assert.equal(
          (
            await dispatchBillingOpsAlert(queue(), env, {
              send: async () => {
                calls++;
                throw Error("Isolated transport timeout; no request");
              },
            })
          ).status,
          "unknown",
        );
        assert.equal((await row(uncertain)).state, "dead");
        assert.equal(
          (await dispatchBillingOpsAlert(queue(), env, { send: sender }))
            .status,
          "empty",
        );
        assert.equal(calls, 2);
      },
    );
    await check(
      "failed dispatch fence rolls back and sends no email; settlement outage is held",
      async () => {
        await clean();
        const id = (await enqueue())!;
        let calls = 0;
        await sql.unsafe(
          "create function private.isolated_ops_audit_outage() returns trigger language plpgsql as $$begin if new.action='billing_ops_dispatch_fenced' then raise exception 'isolated dispatch audit outage';end if;return new;end$$;create trigger isolated_ops_outage before insert on private.audit_events for each row execute function private.isolated_ops_audit_outage()",
        );
        await assert.rejects(
          dispatchBillingOpsAlert(queue(), env, {
            send: async () => {
              calls++;
            },
          }),
        );
        assert.equal(calls, 0);
        assert.equal((await row(id)).payload.phase, "claimed");
        await sql.unsafe(
          "create or replace function private.isolated_ops_audit_outage() returns trigger language plpgsql as $$begin if new.action='billing_ops_settled' then raise exception 'isolated settlement audit outage';end if;return new;end$$",
        );
        await clean();
        const held = (await enqueue())!;
        await assert.rejects(
          dispatchBillingOpsAlert(queue(), env, {
            send: async () => {
              calls++;
            },
          }),
        );
        assert.equal((await row(held)).payload.phase, "dispatching");
        await sql`update private.outbox set lease_until=clock_timestamp()-interval '1 second' where id=${held}`;
        assert.equal(
          (
            await dispatchBillingOpsAlert(queue(), env, {
              send: async () => {
                calls++;
              },
            })
          ).status,
          "empty",
        );
        assert.equal(calls, 1);
        assert.equal((await row(held)).payload.outcome, "unknown");
        await sql.unsafe(
          "drop trigger isolated_ops_outage on private.audit_events;drop function private.isolated_ops_audit_outage()",
        );
      },
    );
    await check(
      "closed admission still records an already fenced provider outcome",
      async () => {
        await clean();
        const id = (await enqueue())!;
        const job = await rpc("claim", { worker: randomUUID() });
        await rpc("fence", {
          id,
          worker: job.lease,
          key: body(await row(id)).key,
        });
        await applyPackage(
          readFileSync(
            "config/operations/billing-ops-outbox.stop.prepared.sql",
            "utf8",
          ),
        );
        assert.equal(await enqueue(), null);
        assert.equal(await rpc("claim", { worker: randomUUID() }), null);
        await rpc("settle", { id, worker: job.lease, outcome: "accepted" });
        assert.equal((await row(id)).state, "sent");
        assert.equal(await protectedHash(), protectedBefore);
        await applyPackage();
        assert.equal((await row(id)).state, "sent");
      },
    );
    const report = {
      at: new Date().toISOString(),
      engine: (await sql`select version() v`)[0].v,
      sqlSha256: createHash("sha256").update(prepared).digest("hex"),
      checks,
      passed: true,
      productionWrites: 0,
      providerCalls: 0,
      emailsSent: 0,
      permanentInventoryIssued: 0,
      protectedRecordsPreserved: true,
      productionApply: false,
    };
    mkdirSync("docs/ops-launch-20261105/alerts-preparation", {
      recursive: true,
    });
    writeFileSync(
      "docs/ops-launch-20261105/alerts-preparation/postgres.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Isolated operational queue check failed",
  );
  process.exitCode = 1;
});
