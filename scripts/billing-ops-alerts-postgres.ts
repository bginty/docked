/** Disposable loopback PostgreSQL only. No provider call, hosted account, email,
 * secret loading, production SQL or scheduler action is permitted here. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import {
  dispatchBillingOpsAlert,
  billingOpsAlertMessage,
} from "../src/server/billing-ops-alerts.mjs";
import { billingOpsQueueRpc } from "../src/server/billing-ops-queue.mjs";
import { leaseOutboxRecord } from "../src/server/outbox-lease";
import { BillingOpsMonitor } from "../src/server/billing-ops-monitor";
import { founderAlertDeliveryDrill } from "./founder-alert-delivery-drill.mjs";
import { CommercialReconciliation } from "../src/server/commercial-reconciliation";
import { CommercialLedger } from "../src/server/commercial-ledger";
import {
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
} from "../src/core/commercial-billing";
import type { GoogleCommercialVerifier } from "../src/server/google-commercial-verifier";

const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.toString(), { max: 16, onnotice: () => {} });
const prepared = readFileSync(
  "config/operations/billing-ops-outbox-v2.prepared.sql",
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
  purchaseFulfilmentFailures: 0,
  duplicateReceiptAttempts: 0,
  receiptReplayRejections: 0,
  refundReconciliationFailures: 0,
  walletLedgerMismatches: 0,
  ledgerIntegrityFailures: 0,
  packIssuanceFailures: 0,
  opsNotificationFailures: 0,
  reconciliationStaleReceipts: 0,
  receiptAcknowledgementFailures: 0,
  reconciliationFailures: 0,
  receiptVerificationFailures: 0,
};
async function approve() {
  await sql`update commercial_billing.control set approvals=jsonb_set(approvals,'{opsAlerts}',${sql.json({ version: "billing-ops-policy-v2", purpose: "billing_ops_health_v1", recipient: "support@docked.com.au", authority: "isolated fixture, not production approval", validUntil: env.DOCKED_BILLING_OPS_UNTIL })},true) where id`;
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
      "alter table private.audit_events enable row level security;grant insert on private.audit_events to docked_app;create policy normal_audit on private.audit_events for insert to docked_app with check(true)",
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
      "delivery uncertainty cannot enqueue email about its own failing channel",
      async () => {
        const stopFixture = Error("rollback isolated delivery-only fixture");
        await assert.rejects(
          sql.begin(async (tx) => {
            await tx`update credits_sandbox.store_notifications set state='done'`;
            await tx`update private.outbox set state='dead',payload=payload||'{"outcome":"unknown","phase":"complete"}' where payload->>'purpose'='billing_ops_health_v1'`;
            await tx.unsafe("set local role docked_commercial_app");
            assert.equal(
              (await tx`select public.docked_billing_ops_enqueue() id`)[0].id,
              null,
            );
            throw stopFixture;
          }),
          (error) => error === stopFixture,
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
    const signal = (code: string, operation = randomUUID()) =>
      as(
        "docked_commercial_app",
        async (tx) =>
          (
            await tx`select public.docked_billing_ops_signal(${code},${operation}::uuid) recorded`
          )[0].recorded,
      );
    const monitoredSql = new Proxy(sql, {
      apply(_target, _this, args) {
        return as("docked_commercial_app", (tx) => Reflect.apply(tx, tx, args));
      },
    }) as Sql;
    let monitoringWarnings = 0;
    const monitor = new BillingOpsMonitor(
      monitoredSql,
      { DOCKED_BILLING_OPS_SIGNALS: "true" },
      () => {
        monitoringWarnings++;
      },
    );
    const currentHealth = async () =>
      (await row((await enqueue())!)).payload.health;
    await check(
      "enum-only signal RPC is disabled/least-privilege/idempotent without raw payloads",
      async () => {
        assert.equal(await signal("purchase_fulfilment_failed"), false);
        await approve();
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "docked_app",
        ] as Role[])
          await assert.rejects(
            as(
              role,
              (tx) =>
                tx`select public.docked_billing_ops_signal('purchase_fulfilment_failed',${randomUUID()}::uuid)`,
            ),
            /permission denied/,
          );
        await assert.rejects(
          as(
            "docked_app",
            (tx) =>
              tx`insert into private.audit_events(actor,action,subject,details)values('spoof','billing_ops_signal','billing-ops','{"code":"purchase_fulfilment_failed"}')`,
          ),
          /row-level security/,
        );
        await as(
          "docked_app",
          (tx) =>
            tx`insert into private.audit_events(actor,action,subject,details)values('fixture','unrelated_service_event','fixture','{}')`,
        );
        await assert.rejects(
          signal("raw-secret-provider-token"),
          /Unsupported operational signal/,
        );
        const operation = randomUUID();
        assert.equal(await signal("receipt_duplicate_retry", operation), true);
        assert.equal(await signal("receipt_duplicate_retry", operation), false);
        await assert.rejects(
          signal("receipt_replay_rejected", operation),
          /idempotency conflict/,
        );
        const [event] =
          await sql`select actor,subject,details from private.audit_events where id=${operation}`;
        assert.deepEqual(event.details, { code: "receipt_duplicate_retry" });
        assert.equal(event.subject, "billing-ops");
      },
    );
    await check(
      "rolled-back fulfilment and pack failures produce separate durable sanitized signals",
      async () => {
        const failure = Error(
          "sensitive fixture details must not enter monitoring",
        );
        await assert.rejects(
          monitor.run("fulfilment", async () => {
            throw failure;
          }),
          (error) => error === failure,
        );
        const key = "rolled-back-pack-fixture";
        await assert.rejects(
          monitor.run("pack", () =>
            sql.begin(async (tx) => {
              await tx`insert into private.outbox(dedupe_key,kind,payload,expires_at)values(${key},'service','{}',clock_timestamp()+interval '1 hour')`;
              await tx`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version)values(${randomUUID()},${randomUUID()},'{"cards":9}',700,'[]','[]','isolated-fault-fixture')`;
            }),
          ),
          /foreign key/,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from private.outbox where dedupe_key=${key}`
          )[0].n,
          0,
        );
        const h = await currentHealth();
        assert(h.purchaseFulfilmentFailures > 0);
        assert(h.packIssuanceFailures > 0);
        assert.equal(
          (
            await sql`select count(*)::int n from private.audit_events where action='billing_ops_signal' and details::text like '%sensitive fixture%'`
          )[0].n,
          0,
        );
      },
    );
    await check(
      "replay denial is not legitimate retry or failed fulfilment",
      async () => {
        const before = await currentHealth();
        await assert.rejects(
          monitor.run("fulfilment", async () => {
            throw Error("Receipt already bound to another account or product");
          }),
          /already bound/,
        );
        const after = await currentHealth();
        assert.equal(
          after.receiptReplayRejections,
          before.receiptReplayRejections + 1,
        );
        assert.equal(
          after.purchaseFulfilmentFailures,
          before.purchaseFulfilmentFailures,
        );
        assert.equal(
          after.duplicateReceiptAttempts,
          before.duplicateReceiptAttempts,
        );
        const expected = Error("Insufficient Docked Credits");
        await assert.rejects(
          monitor.run("pack", async () => {
            throw expected;
          }),
          (error) => error === expected,
        );
        assert.equal(
          (await currentHealth()).packIssuanceFailures,
          after.packIssuanceFailures,
        );
      },
    );
    await check(
      "actual reconciliation hooks distinguish refund, ack and provider outages",
      async () => {
        const previous = process.env.DOCKED_BILLING_OPS_SIGNALS;
        process.env.DOCKED_BILLING_OPS_SIGNALS = "true";
        try {
          for (const stage of [
            "refund",
            "acknowledgement",
            "reconciliation",
          ] as const) {
            const id = "isolated-monitor:" + randomUUID(),
              key = "e".repeat(64);
            await sql`insert into commercial_billing.jobs(id,receipt,kind)values(${id},${key},${stage === "acknowledgement" ? "consume" : "verify"})`;
            const ledger = {
              sql: monitoredSql,
              reference: async () => ({
                token: "isolated-only-not-real",
                account_binding: "fixture",
                member_id: randomUUID(),
              }),
              accept: async () => {
                if (stage === "refund")
                  throw Error("isolated refund SQL failure");
                return { state: "PURCHASED" };
              },
            } as unknown as CommercialLedger;
            const verifier = {
              verify: async () => {
                if (stage === "reconciliation")
                  throw Error("isolated provider outage");
                return { state: stage === "refund" ? "REVOKED" : "PURCHASED" };
              },
              consume: async () => {
                throw Error("isolated acknowledgement outage");
              },
            } as unknown as Pick<
              GoogleCommercialVerifier,
              "verify" | "consume"
            >;
            const worker = new CommercialReconciliation(
              ledger,
              verifier,
              async () => true,
            );
            assert.equal(await worker.runOne(), true);
            assert.equal(
              (
                await sql`select state from commercial_billing.jobs where id=${id}`
              )[0].state,
              "pending",
            );
            await sql`delete from commercial_billing.jobs where id=${id}`;
          }
        } finally {
          if (previous === undefined)
            delete process.env.DOCKED_BILLING_OPS_SIGNALS;
          else process.env.DOCKED_BILLING_OPS_SIGNALS = previous;
        }
        const h = await currentHealth();
        assert(h.refundReconciliationFailures > 0);
        assert(h.receiptAcknowledgementFailures > 0);
        assert(h.reconciliationFailures > 0);
      },
    );
    await check(
      "20 concurrent identical verified receipts produce 19 informational duplicates and one credit",
      async () => {
        const member = randomUUID(),
          peer = randomUUID(),
          token = "isolated-exact-duplicate-observation",
          key = createHash("sha256")
            .update("docked.fantasy\0" + token)
            .digest("hex"),
          product = commercialProducts.find((p) => p.credits === 4900)!;
        const syntheticApprovals = {
          owner: "isolated-fixture",
          legal: "isolated-fixture",
          googlePlay: "isolated-fixture",
          privacy: "isolated-fixture",
          retention: "isolated-fixture",
          refundRecovery: "isolated-fixture",
          playerRights: "isolated-fixture",
          supplyReconciliation: "isolated-fixture",
          validUntil: env.DOCKED_BILLING_OPS_UNTIL,
          withdrawals: false,
          prizes: false,
          paidEntry: false,
          nba: false,
        };
        await sql`update commercial_billing.control set sales_enabled=true,policy_version=${commercialPolicyVersion},approvals=approvals||${sql.json(syntheticApprovals)} where id`;
        await sql`update commercial_billing.products set approved=true where id=${product.id}`;
        const roleSql = new Proxy(monitoredSql, {
          get(target, property, receiver) {
            return property === "begin"
              ? (callback: (tx: Sql) => Promise<unknown>) =>
                  as("docked_commercial_app", callback)
              : Reflect.get(target, property, receiver);
          },
        }) as Sql;
        const ledger = new CommercialLedger(roleSql, "commercial", {
          active: "fixture",
          values: { fixture: randomBytes(32) },
        });
        const receipt: CommercialReceipt = {
          key,
          account: "f".repeat(64),
          environment: "commercial",
          product,
          state: "PURCHASED",
          paid: true,
          consumed: false,
          orderId: "GPA.ISOLATED-EXACT-DUPLICATES",
          grossCents: product.audCents,
          taxCents: null,
          refundedCents: 0,
          providerAt: new Date().toISOString(),
        };
        const authorize = async () => {};
        const before = await currentHealth();
        const results = await Promise.all(
          Array.from({ length: 20 }, () =>
            ledger.accept(receipt, member, token, authorize),
          ),
        );
        assert.equal(results.filter((r) => r.duplicateObservation).length, 19);
        await Promise.all(
          results
            .filter((r) => r.duplicateObservation)
            .map(() => monitor.record("receipt_duplicate_retry")),
        );
        assert.equal(
          (await currentHealth()).duplicateReceiptAttempts,
          before.duplicateReceiptAttempts + 19,
        );
        assert.equal((await ledger.wallet(member)).balance, 4900);
        assert.equal(
          (
            await sql`select count(*)::int n from commercial_billing.lots where receipt=${key}`
          )[0].n,
          1,
        );
        assert.equal(
          (
            await sql`select count(*)::int n from commercial_billing.journals where id=${key + ":credit"}`
          )[0].n,
          1,
        );
        assert.equal(
          (
            await ledger.accept(
              { ...receipt, consumed: true },
              member,
              token,
              authorize,
            )
          ).duplicateObservation,
          false,
        );
        await assert.rejects(
          monitor.run("fulfilment", () =>
            ledger.accept(receipt, peer, token, authorize),
          ),
          /already bound/,
        );
        assert.equal((await ledger.wallet(peer)).balance, 0);
        assert.equal((await ledger.wallet(member)).balance, 4900);
        await sql`update commercial_billing.control set sales_enabled=false where id`;
        await sql`update commercial_billing.products set approved=false where id=${product.id}`;
      },
    );
    await check(
      "derived wallet/journal/pack/refund/stale and delivery faults are actually observed",
      async () => {
        const delivery = (await enqueue())!;
        await sql`update private.outbox set state='dead',payload=payload||'{"outcome":"unknown","phase":"complete"}' where id=${delivery}`;
        const member = randomUUID(),
          one = createHash("sha256")
            .update("docked.fantasy\0isolated-replay-token")
            .digest("hex"),
          two = "d".repeat(64);
        await sql`insert into commercial_billing.accounts(member_id)values(${member})`;
        await sql`insert into commercial_billing.receipts(key,member_id,account_binding,environment,product,state,encrypted_reference,gross_cents,refunded_cents,credited,money_recorded,next_reconcile_at)values(${one},${member},${"a".repeat(64)},'commercial','{}','PURCHASED','isolated-not-a-token',4900,0,false,false,clock_timestamp()-interval '2 hours'),(${two},${member},${"a".repeat(64)},'commercial','{}','REVOKED','isolated-not-a-token',4900,4900,true,true,clock_timestamp())`;
        await sql`insert into commercial_billing.lots(member_id,receipt,source,original,remaining)values(${member},${one},${one},1000,1000),(${member},${two},${two},1000,500)`;
        await sql`insert into commercial_billing.journals(id,unit,actor,reason)values('isolated-empty-journal','CREDITS','fixture','isolated malformed committed record')`;
        await sql`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version)values(${member},${randomUUID()},'{"cards":9}',700,'[]','[]','isolated-invariant-fixture')`;
        await sql`insert into commercial_billing.recovery_cases(id,receipt,member_id,exposure_credits,reason)values(${one},${one},${member},100,'isolated recovery fixture')`;
        const h = await currentHealth();
        assert.equal(h.walletLedgerMismatches, 1);
        assert.equal(h.ledgerIntegrityFailures, 1);
        assert(h.packIssuanceFailures > 0);
        assert(h.refundReconciliationFailures > 0);
        assert.equal(h.reconciliationStaleReceipts, 1);
        assert.equal(h.openRecoveryCases, 1);
        assert(h.opsNotificationFailures > 0);
        assert.equal(
          await monitor.isKnownReceiptReplay(
            "isolated-replay-token",
            member,
            "a".repeat(64),
          ),
          false,
        );
        assert.equal(
          await monitor.isKnownReceiptReplay(
            "isolated-replay-token",
            randomUUID(),
            "a".repeat(64),
          ),
          true,
        );
        assert.equal(
          await monitor.isKnownReceiptReplay(
            "unknown-isolated-token",
            randomUUID(),
            "a".repeat(64),
          ),
          false,
        );
        assert.equal(monitoringWarnings, 0);
      },
    );
    let realDelivery: unknown = null;
    if (process.argv.includes("--founder-email-drill")) {
      await clean();
      assert(await enqueue(), "Durable isolated alert required");
      realDelivery = await founderAlertDeliveryDrill(queue(), env);
      const audit =
        await sql`select action,created_at,details from private.audit_events where action like 'billing_ops%' order by created_at`;
      writeFileSync(
        "docs/qa/v31-final-reconciliation-20261110/email-queue-audit.json",
        JSON.stringify(
          {
            isolated: true,
            audit,
            outbox:
              await sql`select state,attempts,payload->>'phase' phase,payload->>'outcome' outcome from private.outbox where payload->>'purpose'='billing_ops_health_v1'`,
          },
          null,
          2,
        ),
      );
      await sql`update private.feature_flags set enabled=false where key='billing_ops_alerts'`;
    }
    const report = {
      at: new Date().toISOString(),
      engine: (await sql`select version() v`)[0].v,
      sqlSha256: createHash("sha256").update(prepared).digest("hex"),
      checks,
      passed: true,
      productionWrites: 0,
      realDelivery,
      realEmailAttempted: process.argv.includes("--founder-email-drill"),
      permanentInventoryIssued: 0,
      preExistingQueueScenarioRecordsPreserved: true,
      isolatedSyntheticFinancialFaultsSeeded: true,
      productionApply: false,
    };
    const reportDir =
      process.env.DOCKED_DB_TEST_REPORT_DIR ??
      "docs/ops-launch-20261105/alerts-preparation";
    mkdirSync(reportDir, {
      recursive: true,
    });
    writeFileSync(
      process.argv.includes("--founder-email-drill")
        ? "docs/qa/v31-final-reconciliation-20261110/alerts-postgres.json"
        : `${reportDir}/postgres-v2.json`,
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
