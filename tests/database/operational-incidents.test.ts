import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
test("Operational incidents: founder MFA, least privilege, deduplication, concurrency and durable audit", async () => {
  const d = await multiSportDatabase();
  const checks: string[] = [];
  try {
    await d.pg.exec(
      await readFile(
        "supabase/migrations/20261109232124_operational_incident_review.sql",
        "utf8",
      ),
    );
    const session = randomUUID();
    await d.q(
      "update auth.users set email='support@docked.com.au',email_confirmed_at=now() where id=$1",
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
      "insert into private.roles(user_id,role)values($1,'owner') on conflict(user_id)do update set role='owner'",
      [d.user],
    );
    const claims = async (aal: string, user = d.user) =>
      d.q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [user, JSON.stringify({ sub: user, aal, session_id: session })],
      );
    const review = async (action = "read", payload = {}) =>
      (
        await d.q("select operations.review($1,$2) r", [
          action,
          JSON.stringify(payload),
        ])
      )[0].r;
    await claims("aal1");
    await assert.rejects(review(), /MFA/);
    await claims("aal2", d.other);
    await assert.rejects(review(), /MFA/);
    await claims("aal2");
    await d.q("set role docked_app");
    assert.equal((await review()).emailEnabled, false);
    checks.push(
      "normal member and owner without MFA denied; confirmed founder session accepted",
    );
    await assert.rejects(
      d.q("select * from operations.events"),
      /permission denied/,
    );
    await assert.rejects(
      d.q("select operations.observe('forged','critical',1)"),
      /permission denied/,
    );
    await d.q("reset role");
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_commercial_app",
    ]) {
      await d.q("set role " + role);
      await assert.rejects(review(), /permission denied/);
      await d.q("reset role");
    }
    checks.push(
      "no browser/service/commercial runtime access or direct audit/config writes",
    );
    await d.q("set role docked_app");
    await review("refresh");
    await review("report", {
      code: "security_auth_incident",
      reason: "Isolated test security event; no actual breach",
    });
    await assert.rejects(
      review("report", {
        code: "arbitrary",
        reason: "Rejected unapproved category",
      }),
      /category/,
    );
    const first = await review("drill");
    const repeated = await review("drill");
    assert.equal(repeated.events.length, first.events.length);
    assert.equal(repeated.delivery.length, 0);
    const drill = first.incidents.find(
      (r: { code: string }) => r.code === "support_delivery_drill",
    );
    assert.ok(drill);
    const p = {
      code: drill.code,
      revision: drill.revision,
      reason: "Isolated simulated inbox check; no real email sent",
    };
    const acknowledged = await review("acknowledge", p);
    assert.equal(
      acknowledged.incidents.find(
        (r: { code: string }) => r.code === drill.code,
      ).state,
      "ACKNOWLEDGED",
    );
    await assert.rejects(review("resolve", p), /changed/);
    const done = await review("confirm_delivery", {
      ...p,
      revision: drill.revision + 1,
    });
    assert.equal(
      done.incidents.find((r: { code: string }) => r.code === drill.code).state,
      "RESOLVED",
    );
    await review("drill");
    assert.equal(
      (await review()).incidents.find(
        (r: { code: string }) => r.code === drill.code,
      ).state,
      "OPEN",
    );
    checks.push(
      "repeat drill deduplicates; stale review rejected; decisions retained; recurrence reopens",
    );
    await d.q("reset role");
    await assert.rejects(d.q("delete from operations.events"), /immutable/);
    await assert.rejects(d.q("truncate operations.events"), /immutable/);
    assert.equal(
      Number(
        (await d.q("select count(*) n from commercial_billing.cards"))[0].n,
      ),
      0,
    );
    assert.equal(
      Number(
        (await d.q("select count(*) n from commercial_billing.lots"))[0].n,
      ),
      0,
    );
    checks.push(
      "immutable event audit; no financial changes; no email sent or inbox delivery claimed",
    );
    if (process.env.AUSTRALIAN_SALARY_TEST_DB)
      await writeFile(
        "docs/qa/v31-p1-p4-20261110/incidents-postgres.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            database: "disposable PostgreSQL 17",
            checks,
            passed: true,
            realEmail: false,
          },
          null,
          2,
        ) + "\n",
      );
  } finally {
    await d.pg.close();
  }
});
