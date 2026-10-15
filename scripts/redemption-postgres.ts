import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { redemptionFixture } from "../tests/fixtures/redemption-state";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { prepareRedemption } from "../src/server/redemption-adapter";
import { persistRedemptionNotices } from "../src/server/redemption-notifications";
import { redemptionBalance, validateRedemption } from "../src/core/redemption";
import { validateCredits, creditBalances } from "../src/core/credits-sandbox";
import { startRedemptionPreview } from "./redemption-local";
import type { Operator } from "../src/core/commerce-sandbox";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_redemption_local_\d+$/.test(
      url,
    )
  )
    throw Error("Dedicated disposable loopback database required");
  const sql = postgres(url, { max: 1 }),
    other = postgres(url, { max: 1 }),
    checks: string[] = [];
  try {
    await sql.unsafe(await readFile("sandbox/credits.sql", "utf8"));
    await sql.unsafe(
      `create role anon;create role authenticated;create role service_role;create role docked_beta_app;create schema auth;create table auth.users(id uuid primary key);create schema private;create table private.social_profiles(id uuid primary key,user_id uuid,status text);create table private.social_notifications(id uuid default gen_random_uuid(),recipient_id uuid,type text,title text,href text,group_key text,dedupe_key text unique);`,
    );
    await sql.unsafe(
      await readFile(
        "supabase/migrations/20261015055109_manual_credit_redemption.sql",
        "utf8",
      ),
    );
    const f = redemptionFixture(),
      a = f.actors;
    f.state.commerce.cards["local-race-card"] = {
      tier: "RARE",
      sport: "nfl",
      owner: a.other.id,
      reserved: null,
    };
    f.state.cards["local-race-card"] = {
      version: 1,
      restricted: false,
      locked: false,
      history: [
        { from: null, to: a.other.id, reference: "synthetic", at: Date.now() },
      ],
    };
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(f.state as any)})`;
    await sql.begin(async tx=>{for (const j of f.state.journal) {
      await tx`insert into credits_sandbox.journal values(${j.id},${tx.json(j as any)})`;
      for (const [i, line] of j.lines.entries())
        await tx`insert into credits_sandbox.lines values(${j.id},${i},${line.account},${line.credits})`;
    }});
    for (const actor of Object.values(a)) {
      await sql`insert into auth.users values(${actor.id})`;
      await sql`insert into private.social_profiles values(${randomUUID()},${actor.id},'active')`;
    }
    const store = (connection: typeof sql, actor: Operator, ref: string) =>
      new CreditsSandboxStore(
        connection,
        undefined,
        (s, c, now) => prepareRedemption(s, actor, ref, c, now, f.vault),
        persistRedemptionNotices,
      );
    const run = (actor: Operator, ref: string, op: unknown, connection = sql) =>
      store(connection, actor, ref).execute(actor, ref, op);
    const submit = (ref: string, aud = "100.00", connection = sql) =>
      run(
        a.member,
        ref,
        { action: "submit", aud, destination: f.destination, confirmed: true },
        connection,
      );
    const transition = (
      ref: string,
      action: string,
      actor: Operator = a.staff,
      connection = sql,
      extra = {},
    ) =>
      run(
        actor,
        randomUUID(),
        {
          action,
          withdrawal: ref,
          reason: "Local PostgreSQL acceptance",
          ...extra,
        },
        connection,
      );
    const pid1 = await sql`select pg_backend_pid() pid`,
      pid2 = await other`select pg_backend_pid() pid`;
    assert.notEqual(pid1[0].pid, pid2[0].pid);
    const dup = randomUUID();
    await Promise.all([submit(dup), submit(dup, "100.00", other)]);
    assert.equal(
      redemptionBalance(await new CreditsSandboxStore(sql).read(), a.member.id)
        .pending,
      10000,
    );
    await transition(dup, "cancel", a.member);
    checks.push(
      "Separate PostgreSQL connections: duplicate submission reserves once; cancellation releases once",
    );
    const x = randomUUID(),
      y = randomUUID();
    const race = await Promise.allSettled([
      submit(x, "200.00"),
      submit(y, "200.00", other),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await transition(
      race[0].status === "fulfilled" ? x : y,
      "cancel",
      a.member,
    );
    checks.push("Concurrent distinct request IDs cannot over-redeem");
    const claim = randomUUID();
    await submit(claim);
    await transition(claim, "approve");
    const contest = await Promise.allSettled([
      transition(claim, "claim"),
      transition(claim, "cancel", a.member, other),
    ]);
    assert.equal(contest.filter((r) => r.status === "fulfilled").length, 1);
    let s = await new CreditsSandboxStore(sql).read();
    if (s.withdrawals[claim].manual!.status === "PAYMENT_IN_PROGRESS") {
      await transition(claim, "exception");
      await transition(claim, "release-confirmed-unpaid", a.staff, sql, {
        confirmed: true,
        reference: "CONFIRMED-UNPAID",
      });
    }
    checks.push(
      "Cancellation versus payment claim: one transition wins; uncertainty stays reserved",
    );
    const paid = randomUUID();
    await submit(paid);
    await transition(paid, "approve");
    const claims = await Promise.allSettled([
      transition(paid, "claim"),
      transition(paid, "claim", a.staff2, other),
    ]);
    assert.equal(claims.filter((r) => r.status === "fulfilled").length, 1);
    s = await new CreditsSandboxStore(sql).read();
    const claimant =
      s.withdrawals[paid].manual!.claimedBy === a.staff.id ? a.staff : a.staff2;
    const sent = randomUUID(),
      sentOp = {
        action: "sent",
        withdrawal: paid,
        reason: "Synthetic EFT recorded",
        reference: "SYNTHETIC-EFT-PG",
        confirmed: true,
      };
    await Promise.all([
      run(claimant, sent, sentOp),
      run(claimant, sent, sentOp, other),
    ]);
    s = await new CreditsSandboxStore(sql).read();
    assert.equal(redemptionBalance(s, a.member.id).available, 15000);
    const returned = randomUUID(),
      returnOp = {
        action: "return",
        withdrawal: paid,
        reason: "Synthetic EFT returned",
        reference: "SYNTHETIC-RETURN-PG",
        confirmed: true,
      };
    await Promise.all([
      run(a.staff, returned, returnOp),
      run(a.staff, returned, returnOp, other),
    ]);
    assert.equal(
      redemptionBalance(await new CreditsSandboxStore(sql).read(), a.member.id)
        .available,
      25000,
    );
    checks.push(
      "Competing payment staff claims, duplicate sent and duplicate return: one claim, one finalisation, one compensation",
    );
    const before = await new CreditsSandboxStore(sql).read();
    await sql.unsafe(
      `create function credits_sandbox.fail_redemption() returns trigger language plpgsql as $$begin raise exception 'Injected settlement persistence failure';end$$;create trigger fail_redemption before insert on credits_sandbox.history for each row execute function credits_sandbox.fail_redemption()`,
    );
    await assert.rejects(() => submit(randomUUID()), /Injected/);
    assert.deepEqual(await new CreditsSandboxStore(sql).read(), before);
    await sql.unsafe("drop trigger fail_redemption on credits_sandbox.history");
    checks.push(
      "Injected persistence failure fully rolls back reservation, history and notification",
    );
    await assert.rejects(
      () =>
        sql`update credits_sandbox.state set document=jsonb_set(document,'{lots,fixture-test,cashEligibility}','{"scope":"local-redemption-fixture","policy":"synthetic-redemption-v1"}') where id`,
      /immutable/,
    );
    await assert.rejects(
      () =>
        sql`update credits_sandbox.state set document=jsonb_set(document,${["withdrawals", paid, "manual", "audCents"]},'1') where id`,
      /immutable/,
    );
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx.unsafe("set local role authenticated");
          await tx`select * from credits_sandbox.redemption_staff`;
        }),
      /permission/,
    );
    checks.push(
      "Database enforces immutable classifications/financial snapshots and denies member staff-table access",
    );
    const http = await startRedemptionPreview(0, {
      read: () => new CreditsSandboxStore(sql).read(),
      execute: (actor, ref, op) => run(actor, ref, op),
      vault: f.vault,
    });
    try {
      const origin = `http://127.0.0.1:${http.port}`;
      const login = async (role: string) => {
        const r = await fetch(origin + "/qa/session", {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `role=${role}`,
          redirect: "manual",
        });
        return r.headers.get("set-cookie")!.split(";")[0];
      };
      const memberCookie = await login("member"),
        otherCookie = await login("other");
      const ref = randomUUID(),
        op = {
          request: ref,
          operation: {
            action: "submit",
            aud: "1.00",
            destination: f.destination,
            confirmed: true,
          },
        };
      const send = async (cookie: string, body: unknown) =>
        fetch(origin + "/api/redemptions", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      const response = await send(memberCookie, op);
      assert.equal(response.status, 200);
      const receipt = await response.json();
      assert.ok(receipt.requests.some((r: any) => r.id === ref));
      assert.equal((await send(memberCookie, op)).status, 200);
      assert.equal(
        (
          await send(otherCookie, {
            request: randomUUID(),
            operation: {
              action: "cancel",
              withdrawal: ref,
              reason: "Cross-account attempt",
            },
          })
        ).status,
        400,
      );
      const privacy = await (
        await fetch(origin + "/api/redemptions", {
          headers: { Cookie: otherCookie },
        })
      ).json();
      assert.equal(privacy.requests.length, 0);
      assert.equal((await fetch(origin + "/api/redemptions")).status, 401);
      assert.equal(
        (
          await fetch(origin + "/api/redemptions?admin=true", {
            headers: { Cookie: otherCookie },
          })
        ).status,
        400,
      );
      await send(memberCookie, {
        request: randomUUID(),
        operation: {
          action: "cancel",
          withdrawal: ref,
          reason: "Local request complete",
        },
      });
      checks.push(
        "Actual local HTTP → fixture session → PostgreSQL reservation/retry/receipt/privacy journey (not Supabase authentication)",
      );
    } finally {
      await new Promise<void>((done, reject) =>
        http.server.close((e) => (e ? reject(e) : done())),
      );
    }
    const native = new CreditsSandboxStore(sql),
      nativeOther = new CreditsSandboxStore(other);
    await native.execute(a.other, "market-list", {
      kind: "list",
      card: "local-race-card",
      price: 30000,
    });
    await native.execute(a.member, "market-review", {
      kind: "review-buy",
      listing: "market-list",
    });
    const spendRef = randomUUID();
    const spending = await Promise.allSettled([
      submit(spendRef, "250.00"),
      nativeOther.execute(a.member, "market-buy", {
        kind: "buy",
        listing: "market-list",
        expectedPrice: 30000,
        review: "market-review",
        policy: f.state.policy.version,
        confirmed: true,
      }),
    ]);
    assert.equal(spending.filter((r) => r.status === "fulfilled").length, 1);
    s = await native.read();
    validateCredits(s);
    validateRedemption(s);
    const ledgerRows =
      await sql`select account,sum(credits)::bigint credits from credits_sandbox.lines group by account`;
    const relational = Object.fromEntries(
      ledgerRows.map((r) => [r.account, Number(r.credits)]),
    );
    assert.deepEqual(relational, creditBalances(s));
    assert.equal(
      Object.values(relational).reduce((n, x) => n + x, 0),
      0,
    );
    for (const [account, balance] of Object.entries(creditBalances(s)))
      if (account.startsWith("lot:")) assert.ok(balance >= 0);
    assert.equal(creditBalances(s)["system:fixture-seed"], -35000);
    checks.push(
      "Real marketplace purchase versus redemption shares transaction lock/FIFO: no overspend, negative balances or new issuance",
    );
    const notices = await sql`select * from private.social_notifications`;
    assert.ok(notices.length > 0);
    assert.equal(
      notices.length,
      new Set(notices.map((n) => n.dedupe_key)).size,
    );
    assert.ok(notices.every((n) => !n.title.includes("1234")));
    checks.push(
      "Existing in-app account-notice table receives deduplicated generic events without bank/evidence content",
    );
    await mkdir("docs/qa/redemption", { recursive: true });
    await writeFile(
      "docs/qa/redemption/postgres.json",
      JSON.stringify(
        {
          passed: true,
          checks,
          distinctConnections: true,
          authentication:
            "Local fixture sessions; Supabase integration not exercised",
          hostedMutation: false,
        },
        null,
        2,
      ),
    );
    console.log(`PASS: ${checks.length} PostgreSQL/HTTP acceptance groups`);
  } finally {
    await Promise.all([sql.end(), other.end()]);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local test failed");
  process.exitCode = 1;
});
