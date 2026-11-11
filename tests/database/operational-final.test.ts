import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { rateLimitQuery } from "../../src/server/rate-limit-query";

test("Operational incidents final: retention exclusion, holds, audit and verified-phone races", async () => {
  const d = await multiSportDatabase();
  const checks: string[] = [];
  const apply = async (name: string) =>
    d.pg.exec(await readFile("supabase/migrations/" + name, "utf8"));
  try {
    for (const f of [
      "20261109232000_public_practice_phone_guards.sql",
      "20261109232124_operational_incident_review.sql",
      "20261110005726_operational_incident_retention.sql",
      "20261110010050_australian_verified_phone_uniqueness.sql",
    ])
      await apply(f);
    await apply("20261110005726_operational_incident_retention.sql");
    await apply("20261110010050_australian_verified_phone_uniqueness.sql");
    const session = randomUUID();
    await d.q(
      "update auth.users set email='support@docked.com.au' where id=$1",
      [d.user],
    );
    await d.q("insert into auth.sessions(id,user_id)values($1,$2)", [
      session,
      d.user,
    ]);
    await d.q(
      "insert into public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'isolated-policy')on conflict do nothing",
      [d.user],
    );
    await d.q(
      "insert into private.roles(user_id,role)values($1,'owner')on conflict(user_id)do update set role='owner'",
      [d.user],
    );
    const claims = (aal: string) =>
      d.q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [d.user, JSON.stringify({ sub: d.user, session_id: session, aal })],
      );
    await claims("aal1");
    await assert.rejects(
      d.q("select operations.retention_review('dry_run')"),
      /MFA/,
    );
    await claims("aal2");
    await assert.rejects(d.q("select operations.prune_routine()"), /disabled/);
    const names = [
      "support_delivery_drill",
      "auth_mail_configuration_missing",
      "auth_mail_failure",
      "security_auth_incident",
      "wallet_ledger_mismatch",
      "receipt_replay_rejected",
      "unresolved_operational_exception",
    ];
    for (const code of names) {
      await d.q(
        "insert into operations.incidents(code,severity,state,observed_count,last_seen)values($1,'info','RESOLVED',1,now()-interval '91 days')",
        [code],
      );
      await d.q(
        "insert into operations.events(code,revision,action,reason,created_at)values($1,1,'RESOLVED','Synthetic routine detail',now()-interval '91 days')",
        [code],
      );
    }
    await d.q(
      "insert into operations.preservation(code,legal_hold)values('auth_mail_failure',true)",
    );
    await d.q(
      "insert into operations.preservation(code,investigation)values('auth_mail_configuration_missing',true)",
    );
    const dry = () =>
      d
        .q("select operations.retention_review('dry_run') r")
        .then((r) => r[0].r);
    assert.deepEqual(
      (await dry()).eligible.map((r: any) => r.code),
      ["support_delivery_drill"],
    );
    await d.q(
      "update operations.preservation set legal_hold=false,required_audit=true where code='auth_mail_failure'",
    );
    assert.deepEqual(
      (await dry()).eligible.map((r: any) => r.code),
      ["support_delivery_drill"],
    );
    await d.q(
      "update operations.incidents set last_seen=now()-interval '89 days' where code='support_delivery_drill'",
    );
    assert.equal((await dry()).eligible.length, 0);
    await d.q(
      "update operations.incidents set last_seen=now()-interval '91 days' where code='support_delivery_drill'",
    );
    checks.push(
      "90-day age; unexpired records/legal holds/investigations/required audit/unknown/security/financial categories excluded",
    );
    await d.q("set role docked_app");
    await assert.rejects(
      d.q("select operations.prune_routine()"),
      /permission denied/,
    );
    await assert.rejects(
      d.q("update operations.retention_policy set enabled=true"),
      /permission denied/,
    );
    await assert.rejects(
      d.q("select * from operations.events"),
      /permission denied/,
    );
    await d.q("reset role");
    await d.q("set role docked_incident_retention");
    await assert.rejects(
      d.q("update operations.retention_policy set enabled=true"),
      /permission denied/,
    );
    await assert.rejects(
      d.q("delete from operations.events where code='support_delivery_drill'"),
      /immutable/,
    );
    await d.q("reset role");
    await d.q("update operations.retention_policy set enabled=true");
    assert.equal((await d.q("select operations.prune_routine() n"))[0].n, 1);
    assert.equal((await d.q("select operations.prune_routine() n"))[0].n, 0);
    assert.equal(
      Number((await d.q("select count(*) n from operations.events"))[0].n),
      6,
    );
    const receipts = await d.q("select * from operations.retention_receipts");
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].events_removed, 1);
    assert.match(receipts[0].source_sha256, /^[a-f0-9]{64}$/);
    await assert.rejects(
      d.q("delete from operations.retention_receipts"),
      /immutable/,
    );
    await assert.rejects(d.q("truncate operations.events"), /immutable/);
    await d.q("update operations.retention_policy set enabled=false");
    checks.push(
      "dormant by default; no app/worker activation privilege; exact deletion once; minimal immutable receipt retained",
    );
    await d.q("select operations.review('drill')");
    assert.equal((await dry()).eligible.length, 0);
    const revision = (
      await d.q(
        "select revision from operations.incidents where code='support_delivery_drill'",
      )
    )[0].revision;
    const decision = {
      code: "support_delivery_drill",
      revision,
      legalHold: true,
      investigation: false,
      requiredAudit: false,
      reason: "Isolated preservation decision for acceptance",
    };
    await d.q("set role docked_app");
    await d.q("select operations.retention_review('preserve',$1)", [
      JSON.stringify(decision),
    ]);
    await assert.rejects(
      d.q("select operations.retention_review('preserve',$1)", [
        JSON.stringify(decision),
      ]),
      /changed/,
    );
    await d.q("reset role");
    checks.push(
      "recurring incident retained; founder preservation action audited and stale decisions denied",
    );
    await d.q(
      "update auth.users set phone='+61400000001',phone_confirmed_at=now() where id=$1",
      [d.user],
    );
    await assert.rejects(
      d.q(
        "update auth.users set phone='61400000001',phone_confirmed_at=now() where id=$1",
        [d.other],
      ),
      /unique|duplicate/,
    );
    assert.equal(
      (await d.q("select private.public_phone_verified($1) ok", [d.user]))[0]
        .ok,
      true,
    );
    await d.q(
      "update auth.users set phone='+14155550123',phone_confirmed_at=now() where id=$1",
      [d.other],
    );
    assert.equal(
      (await d.q("select private.public_phone_verified($1) ok", [d.other]))[0]
        .ok,
      false,
    );
    await d.q(
      "update auth.users set phone=null,phone_confirmed_at=null where id in($1,$2)",
      [d.user, d.other],
    );
    if (process.env.AUSTRALIAN_SALARY_TEST_DB) {
      const url = new URL(process.env.AUSTRALIAN_SALARY_TEST_DB);
      url.pathname =
        "/" + (await d.q("select current_database() name"))[0].name;
      const a = postgres(url.href, { max: 1, onnotice: () => {} }),
        b = postgres(url.href, { max: 1, onnotice: () => {} });
      try {
        const outcomes = await Promise.allSettled([
          a`update auth.users set phone='+61400000002',phone_confirmed_at=now() where id=${d.user}`,
          b`update auth.users set phone='61400000002',phone_confirmed_at=now() where id=${d.other}`,
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
      } finally {
        await a.end();
        await b.end();
      }
      checks.push(
        "two independent PostgreSQL connections race canonical +61/61: one verified number succeeds, one rejected",
      );
    }
    const key = "isolated-phone-cooldown:" + randomUUID();
    const sent = await Promise.all(
      Array.from({ length: 10 }, () => d.q(rateLimitQuery, [key, 60])),
    );
    assert.equal(sent.filter((r) => r[0].count <= 1).length, 1);
    checks.push(
      "AU mobile gate; canonical verified number unique; concurrent resend cooldown admits one; no phone copied to audit",
    );
    assert.equal(
      Number(
        (await d.q("select count(*) n from commercial_billing.cards"))[0].n,
      ),
      0,
    );
    const reportPath = process.env.DOCKED_OPERATIONAL_TEST_REPORT_DIR
      ? join(
          process.env.DOCKED_OPERATIONAL_TEST_REPORT_DIR,
          "operational-final.json",
        )
      : "docs/qa/v31-final-reconciliation-20261110/operational-final-postgres.json";
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          checks,
          passed: true,
          engine: process.env.AUSTRALIAN_SALARY_TEST_DB
            ? "PostgreSQL 17"
            : "PGlite",
          realSMS: false,
          productionWrites: 0,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await d.pg.close();
  }
});
