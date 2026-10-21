// Isolated real-PostgreSQL contention test; refuses every non-local database.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
import { packFixture } from "../tests/fixtures/pack-economy";
import { executeCredits, wallet } from "../src/core/credits-sandbox";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
import { quoteCoupon } from "../src/core/pack-coupons";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "",
    target = new URL(url);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/docked_free_play_test_\d+$/);
  const sql = postgres(url, { max: 1, onnotice: () => {} }),
    connections = [postgres(url, { max: 1 }), postgres(url, { max: 1 })];
  const owner = "10000000-0000-4000-8000-000000000001",
    members = [
      "10000000-0000-4000-8000-000000000002",
      "10000000-0000-4000-8000-000000000003",
    ];
  try {
    await sql.unsafe(`create role anon;create role authenticated;create role service_role;create role docked_beta_app;
 create schema auth;create schema credits_sandbox;create schema beta_private;create schema beta_fantasy;create schema sports_feed;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('qa.aal',true))$$;
 create function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;
 create table beta_private.roles(user_id uuid,role text);insert into beta_private.roles values('${owner}','owner');
 create table credits_sandbox.state(id boolean primary key,revision bigint,document jsonb);
 create table credits_sandbox.journal(id text primary key,document jsonb);create table credits_sandbox.lines(id text,n int,account text,credits bigint);
 create table credits_sandbox.history(revision bigint,actor text,request text,document jsonb);
 create table beta_private.social_profiles(id uuid,user_id uuid);create table beta_private.social_posts(id uuid,author_id uuid);
 create function beta_private.social_post_visible(uuid,uuid) returns boolean language sql as $$select true$$;
 create table beta_fantasy.entries(user_id uuid);create table beta_fantasy.competitions(id uuid,scored_at timestamptz);
 create table sports_feed.nfl_rounds(competition_id uuid,purpose text,next_check timestamptz);
 create function sports_feed.owner_scoring_diagnostics() returns jsonb language sql as $$select '{}'::jsonb$$;`);
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261021104437_member_community_pack_integrity.sql",
        "utf8",
      ),
    );
    const now = Date.now(),
      actor = { id: owner, role: "reviewer", aal: "aal2" } as const;
    let state = packFixture();
    const product = paidPackCatalogueUpgrade(state.economy!, now).find(
      (p) => p.type === "STANDARD" && p.cards === 9,
    )!;
    for (const p of Object.values(state.economy!.players)) p.observedAt = now;
    for (const member of members)
      state = executeCredits(
        state,
        actor,
        "fund-" + member,
        {
          kind: "promotion",
          member,
          amount: 10000,
          campaign: "isolated",
          reason: "Local concurrency test",
          confirmed: true,
          redeemable: false,
        },
        now,
      ).state;
    const terms = {
      code: "LOCAL50",
      type: "percent",
      value: 50,
      sport: "nfl",
      products: [product.id],
      startsAt: now - 60000,
      expiresAt: now + 86400000,
      totalLimit: 1,
      accountLimit: 1,
      maximumDiscount: 350,
      firstPurchaseOnly: false,
      allowZero: false,
    };
    state = executeCredits(
      state,
      actor,
      "draft",
      {
        kind: "manage-coupon",
        mutation: { action: "save", terms, expectedRevision: 0 },
      },
      now,
    ).state;
    state = executeCredits(
      state,
      actor,
      "activate",
      {
        kind: "manage-coupon",
        mutation: { action: "activate", code: terms.code, expectedRevision: 1 },
      },
      now,
    ).state;
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(state as any)})`;
    const stores = connections.map(
      (connection, i) =>
        new CreditsSandboxStore(connection, async (tx) => {
          await tx`select set_config('qa.uid',${members[i]},true),set_config('qa.aal','aal1',true)`;
        }),
    );
    const commands = members.map((member) => ({
      kind: "buy-pack",
      product: product.id,
      configuration: product.version,
      coupon: terms.code,
      couponQuote: quoteCoupon(state, member, terms.code, product, now)
        .fingerprint,
      expectedPrice: 350,
      policy: state.policy.version,
      confirmed: true,
    }));
    let pending!: Promise<PromiseSettledResult<unknown>[]>;
    await Promise.all(connections.map((c) => c`select pg_backend_pid()`));
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820342)`;
      pending = Promise.allSettled(
        stores.map((store, i) =>
          store.execute(
            { id: members[i], role: "member" },
            "purchase-" + i,
            commands[i],
          ),
        ),
      );
      let waiting = 0;
      for (let attempt = 0; attempt < 50; attempt++) {
        await tx`select pg_stat_clear_snapshot()`;
        const [r] =
          await tx`select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event='advisory'`;
        waiting = r.n;
        if (waiting === 2) break;
        await tx`select pg_sleep(0.05)`;
      }
      assert.equal(
        waiting,
        2,
        "Both buyers must contend on the actual settlement lock",
      );
    });
    const results = await pending;
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const winner = results.findIndex((r) => r.status === "fulfilled");
    await stores[winner].execute(
      { id: members[winner], role: "member" },
      "purchase-" + winner,
      commands[winner],
    );
    const [{ document: after }] =
      await sql`select document from credits_sandbox.state`;
    assert.equal(Object.keys(after.packCoupons.redemptions).length, 1);
    assert.equal(
      Object.keys(after.economy.packs).length,
      Object.keys(state.economy!.packs).length + 1,
    );
    assert.equal(
      wallet(after, members[winner]).available,
      wallet(state, members[winner]).available - 350,
    );
    assert.equal(
      wallet(after, members[1 - winner]).available,
      wallet(state, members[1 - winner]).available,
    );
    const report = {
      passed: true,
      actualPostgres: true,
      contendingBuyers: 2,
      successfulRedemptions: 1,
      replayPacks: 0,
      loserCharge: 0,
      authentication:
        "Synthetic local identities; no hosted customers or HTTP authentication exercised",
    };
    writeFileSync(
      "docs/qa/member-integrity/coupon-contention.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await Promise.all(connections.map((c) => c.end()));
    await sql.end();
  }
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Local test failed");
  process.exitCode = 1;
});
