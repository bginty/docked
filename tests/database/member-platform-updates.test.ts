import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { premiumUltraPackUpgrade } from "../../src/core/card-economy";
import { rarityConfiguration } from "../../src/core/card-rarity";
import { executeCredits } from "../../src/core/credits-sandbox";
import { applyPaidPackTransition } from "../../src/server/paid-pack-transition";
import { applyWeeklyPrizeTemplates } from "../../src/server/weekly-prize-transition";
import { paidPackOffers } from "../../src/core/paid-pack-catalogue";
test("integrated catalogue, future prize templates, authorised export and durable sale receipts", async () => {
  const pg = new PGlite();
  const q = async (s: string, p: unknown[] = []) =>
    (await pg.query<any>(s, p)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)$$;`,
    );
    let now = Date.now();
    let s = marketplaceFixture(now);
    premiumUltraPackUpgrade(s.economy!, now);
    for (const [i, a] of marketActors.entries()) {
      await q(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [a.id],
      );
      await q(
        "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at) values($1,$2,md5(($2::uuid)::text)||md5(($2::uuid)::text),gen_random_uuid(),clock_timestamp()+interval '1 day')",
        [a.id + "@fixture.invalid", a.id],
      );
      await q(
        `update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions='{"terms":"fixture"}' where user_id=$1`,
        [a.id],
      );
      await q(
        "insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'fixture')",
        [a.id],
      );
      await q(
        "insert into beta_private.social_profiles(user_id,handle,display_name)values($1,$2,$3)",
        [a.id, `member_${i}`, `Member ${i}`],
      );
    }
    await q("insert into credits_sandbox.rarity_configuration values($1,$2)", [
      rarityConfiguration.version,
      rarityConfiguration,
    ]);
    for (const p of Object.values(s.economy!.players))
      await q(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [p.id, p.sport, p.provider, p.providerId, p.assetKind, p],
      );
    for (const p of Object.values(s.economy!.products))
      await q("insert into credits_sandbox.pack_configuration values($1,$2)", [
        p.version,
        p,
      ]);
    await q("insert into credits_sandbox.state values(true,0,$1)", [s]);
    const query = (sql: string, values?: unknown[]) =>
      pg.query<Record<string, any>>(sql, values);
    await pg.exec("begin");
    assert.equal((await applyPaidPackTransition(query)).changed, true);
    await pg.exec("commit");
    await pg.exec("begin");
    assert.equal((await applyPaidPackTransition(query)).changed, false);
    await pg.exec("commit");
    s = (await q("select document from credits_sandbox.state"))[0].document;
    now = Date.now();
    for (const offer of paidPackOffers) {
      s = executeCredits(
        s,
        marketActors[0],
        offer.id,
        {
          kind: "buy-pack",
          product: offer.id,
          configuration: offer.id,
          expectedPrice: offer.priceCredits,
          confirmed: true,
          policy: s.policy.version,
        },
        now,
      ).state;
      await q("update credits_sandbox.state set document=$1", [s]);
      s = executeCredits(
        s,
        marketActors[0],
        "open-" + offer.id,
        { kind: "open-pack", entitlement: offer.id },
        now + 1,
      ).state;
      await q("update credits_sandbox.state set document=$1", [s]);
      assert.equal(
        (
          await q(
            "select document from credits_sandbox.pack_receipts where id=$1",
            [offer.id],
          )
        )[0].document.cards.length,
        offer.cards,
      );
    }
    await pg.exec("begin");
    await applyWeeklyPrizeTemplates(query, 2026, 7);
    await pg.exec("commit");
    for (const [mode, w] of [
      ["SALARY_CAP", 7],
      ["OPEN", 7],
      ["OPEN", 6],
    ] as const)
      await q(
        `insert into beta_fantasy.competitions(name,sport,season,round,locks_at,rules,scoring_id)values('Local','nfl','2026',$1,now()+interval '1 day',$2,(select id from beta_fantasy.scoring_rules limit 1))`,
        [w, { mode }],
      );
    const schedules = await q(
      "select mode,published,scope from beta_fantasy.prize_schedules",
    );
    assert.equal(schedules.length, 2);
    for (const p of schedules) {
      assert.equal(p.scope, "weekly");
      assert.deepEqual(
        p.published.map((i: any) => i.amount),
        [5, 3, 1],
      );
      assert.ok(
        p.published.every((i: any) =>
          i.productVersion.includes(
            p.mode === "OPEN" ? "premium-9" : "standard-9",
          ),
        ),
      );
    }
    await pg.exec("begin");
    await applyWeeklyPrizeTemplates(query, 2026, 7);
    await pg.exec("commit");
    assert.equal(
      (await q("select * from beta_fantasy.prize_schedules")).length,
      2,
    );
    const card = Object.keys(s.cards).find(
      (id) => s.commerce.cards[id].owner === marketActors[0].id,
    )!;
    const run = (i: number, key: string, command: unknown) => {
      s = executeCredits(s, marketActors[i], key, command, now).state;
    };
    run(0, "listing-local", { kind: "list", card, price: 1000 });
    run(1, "review-local", { kind: "review-buy", listing: "listing-local" });
    await q("update credits_sandbox.state set document=$1", [s]);
    assert.equal(
      (await q("select * from credits_sandbox.sale_notification_outbox"))
        .length,
      0,
    );
    const buy = {
      kind: "buy",
      listing: "listing-local",
      review: "review-local",
      expectedPrice: 1000,
      policy: s.policy.version,
      confirmed: true,
    };
    run(1, "buy-local", buy);
    for (const j of s.journal)
      await q(
        "insert into credits_sandbox.journal values($1,$2) on conflict do nothing",
        [j.id, j],
      );
    await q("update credits_sandbox.state set document=$1", [s]);
    run(1, "buy-local", buy);
    await q("update credits_sandbox.state set document=$1", [s]);
    assert.equal(
      (await q("select * from credits_sandbox.sale_notification_outbox"))
        .length,
      1,
    );
    await pg.exec(
      "alter table beta_private.social_notifications add constraint isolated_delivery_failure check(false) not valid",
    );
    assert.equal(
      (await q("select credits_sandbox.deliver_sale_receipts() n"))[0].n,
      0,
    );
    assert.equal(
      (
        await q("select attempts from credits_sandbox.sale_notification_outbox")
      )[0].attempts,
      1,
    );
    assert.deepEqual(
      (await q("select document from credits_sandbox.state"))[0].document,
      JSON.parse(JSON.stringify(s)),
      "notification failure cannot reverse settlement",
    );
    await pg.exec(
      "alter table beta_private.social_notifications drop constraint isolated_delivery_failure",
    );
    assert.equal(
      (await q("select credits_sandbox.deliver_sale_receipts() n"))[0].n,
      1,
    );
    assert.equal(
      (await q("select credits_sandbox.deliver_sale_receipts() n"))[0].n,
      0,
    );
    const notices = await q(
      "select title,href from beta_private.social_notifications where group_key='market-sales'",
    );
    assert.equal(notices.length, 1);
    assert.match(notices[0].title, /1000 credits. Fee: 50. You received 950/);
    assert.equal(
      notices[0].href,
      "/fantasy/market?tab=activity&sale=listing-local",
    );
    await q("select set_config('request.jwt.claim.sub',$1,false)", [
      marketActors[1].id,
    ]);
    assert.ok(
      Array.isArray(
        (await q("select sports_feed.play_standings() rows"))[0].rows,
      ),
    );
    assert.deepEqual(
      (await q("select beta_fantasy.collection_export_legacy() cards"))[0]
        .cards,
      [],
    );
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => q("select * from credits_sandbox.sale_notification_outbox"),
      /permission/,
    );
    await assert.rejects(
      () => q("select beta_fantasy.collection_export_legacy()"),
      /permission/,
    );
    await pg.exec("reset role");
    // Activation closes the older acquisition path without deleting an earned
    // legacy entitlement. Replaying the migration must not change that decision.
    await q(
      "insert into sports_feed.nfl_starter_entitlements(user_id) values($1)",
      [marketActors[0].id],
    );
    await q("update sports_feed.weekly_core_control set enabled=true");
    await q(
      "insert into sports_feed.nfl_starter_entitlements(user_id) values($1) on conflict do nothing",
      [marketActors[0].id],
    );
    await q(
      "insert into sports_feed.nfl_starter_entitlements(user_id) values($1) on conflict do nothing",
      [marketActors[1].id],
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from sports_feed.nfl_starter_entitlements",
        )
      )[0].n,
      1,
    );
    await assert.rejects(
      () => q("select sports_feed.nfl_allocate($1)", [marketActors[1].id]),
      /weekly starter packs/,
    );
    await pg.exec(
      await readFile(
        "supabase/migrations/20261019050005_weekly_core_legacy_cutover.sql",
        "utf8",
      ),
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from sports_feed.nfl_starter_entitlements",
        )
      )[0].n,
      1,
    );
    assert.equal(
      (
        await q(
          "select has_function_privilege('docked_beta_app','sports_feed.nfl_allocate_before_weekly_cutover(uuid)','EXECUTE') allowed",
        )
      )[0].allowed,
      false,
    );
    await q("update sports_feed.weekly_core_control set enabled=false");
    await assert.rejects(
      () => q("select sports_feed.nfl_allocate($1)", [marketActors[1].id]),
      /weekly starter packs/,
    );
    await pg.exec(
      await readFile(
        "supabase/migrations/20261019050004_member_platform_updates.sql",
        "utf8",
      ),
    );
    assert.equal(
      (
        await q(
          "select * from beta_private.social_notifications where group_key='market-sales'",
        )
      ).length,
      1,
    );
    assert.equal(
      (await q("select count(*)::int n from sports_feed.weekly_core_packs"))[0]
        .n,
      0,
    );
  } finally {
    await pg.close();
  }
});
