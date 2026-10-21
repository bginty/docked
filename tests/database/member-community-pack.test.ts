import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { packFixture, packNow } from "../fixtures/pack-economy";
import { executeCredits } from "../../src/core/credits-sandbox";
import { paidPackCatalogueUpgrade } from "../../src/core/card-economy";
import { quoteCoupon, type CouponTerms } from "../../src/core/pack-coupons";
const owner = "10000000-0000-4000-8000-000000000001",
  member = "10000000-0000-4000-8000-000000000002",
  competition = "10000000-0000-4000-8000-000000000003";
test("database coupon guards, QA privacy and idempotent unfinished-round retry", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create role docked_beta_app;
 create schema auth;create schema credits_sandbox;create schema beta_private;create schema beta_fantasy;create schema sports_feed;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('qa.aal',true))$$;
 create function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;
 create table beta_private.roles(user_id uuid,role text);insert into beta_private.roles values('${owner}','owner');
 create table credits_sandbox.state(id boolean primary key,document jsonb);
 create table beta_private.social_profiles(id uuid,user_id uuid);create table beta_private.social_posts(id uuid,author_id uuid);
 create function beta_private.social_post_visible(uuid,uuid) returns boolean language sql as $$select true$$;
 create table beta_fantasy.entries(user_id uuid);create table beta_fantasy.competitions(id uuid,scored_at timestamptz);
 create table sports_feed.nfl_rounds(competition_id uuid,purpose text,next_check timestamptz);
 create function sports_feed.owner_scoring_diagnostics() returns jsonb language plpgsql as $$begin if auth.uid() is distinct from '${owner}'::uuid or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Owner MFA required';end if;return '{}';end$$;
 insert into beta_fantasy.competitions values('${competition}',null);insert into sports_feed.nfl_rounds values('${competition}','member',clock_timestamp()+interval '1 hour');`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20261021104437_member_community_pack_integrity.sql",
        "utf8",
      ),
    );
    let s = packFixture();
    const [p] = paidPackCatalogueUpgrade(s.economy!, packNow).filter(
      (p) => p.cards === 9 && p.type === "STANDARD",
    );
    const now = Date.now();
    for (const player of Object.values(s.economy!.players))
      player.observedAt = now;
    const actor = { id: owner, role: "reviewer", aal: "aal2" } as const;
    s = executeCredits(
      s,
      actor,
      "fund",
      {
        kind: "promotion",
        member,
        amount: 10000,
        campaign: "local-db-only",
        reason: "Isolated test",
        confirmed: true,
        redeemable: false,
      },
      now,
    ).state;
    await db.query("insert into credits_sandbox.state values(true,$1)", [
      JSON.stringify(s),
    ]);
    const terms: CouponTerms = {
      code: "LOCAL50",
      type: "percent",
      value: 50,
      sport: "nfl",
      products: [p.id],
      startsAt: now - 60000,
      expiresAt: now + 86400000,
      totalLimit: 1,
      accountLimit: 1,
      maximumDiscount: 350,
      firstPurchaseOnly: true,
      allowZero: false,
    };
    const draft = executeCredits(
      s,
      actor,
      "save",
      {
        kind: "manage-coupon",
        mutation: { action: "save", terms, expectedRevision: 0 },
      },
      now,
    ).state;
    const save = (v: unknown) =>
      db.query("update credits_sandbox.state set document=$1 where id", [
        JSON.stringify(v),
      ]);
    await db.exec(`set qa.uid='${member}';set qa.aal='aal1'`);
    await assert.rejects(() => save(draft), /staff MFA/);
    await db.exec(`set qa.uid='${owner}';set qa.aal='aal2'`);
    await save(draft);
    s = executeCredits(
      draft,
      actor,
      "activate",
      {
        kind: "manage-coupon",
        mutation: { action: "activate", code: terms.code, expectedRevision: 1 },
      },
      now,
    ).state;
    await save(s);
    const quote = quoteCoupon(s, member, terms.code, p, now);
    const bought = executeCredits(
      s,
      { id: member, role: "member" },
      "purchase",
      {
        kind: "buy-pack",
        product: p.id,
        configuration: p.version,
        coupon: quote.code,
        couponQuote: quote.fingerprint,
        expectedPrice: 350,
        policy: s.policy.version,
        confirmed: true,
      },
      now,
    ).state;
    await db.exec(`set qa.uid='${member}';set qa.aal='aal1'`);
    const forged = structuredClone(bought);
    forged.packCoupons!.redemptions.purchase.charge = 0;
    forged.economy!.packs.purchase.pricing!.charge = 0;
    await assert.rejects(() => save(forged), /does not reconcile/);
    await save(bought);
    await save(bought);
    const changed = structuredClone(bought);
    changed.packCoupons!.redemptions.purchase.saving = 999;
    await assert.rejects(() => save(changed), /immutable/);
    assert.equal(
      (
        await db
          .query<{ n: number }>(
            "select jsonb_object_length(document#>'{packCoupons,redemptions}') n from credits_sandbox.state",
          )
          .catch(async () =>
            db.query<{ n: number }>(
              "select count(*)::int n from credits_sandbox.state s,jsonb_each(s.document#>'{packCoupons,redemptions}')",
            ),
          )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      () => db.exec(`select sports_feed.request_round_retry('${competition}')`),
      /Owner MFA/,
    );
    await db.exec(
      `set qa.uid='${owner}';set qa.aal='aal2';select sports_feed.request_round_retry('${competition}');select sports_feed.request_round_retry('${competition}')`,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from sports_feed.owner_retry_requests",
        )
      ).rows[0].n,
      1,
    );
    await db.exec(
      `update beta_fantasy.competitions set scored_at=clock_timestamp()`,
    );
    await assert.rejects(
      () => db.exec(`select sports_feed.request_round_retry('${competition}')`),
      /unfinished/,
    );
    await db.exec(
      `insert into beta_private.internal_qa_entities values('post','${competition}','Isolated explicit fixture provenance',default),('account','${member}','Isolated explicit identity provenance',default)`,
    );
    assert.equal(
      (
        await db.query<{ visible: boolean }>(
          `select beta_private.social_post_visible('${owner}','${competition}') visible`,
        )
      ).rows[0].visible,
      false,
    );
    await assert.rejects(
      () => db.exec(`insert into beta_fantasy.entries values('${member}')`),
      /isolated competition/,
    );
    await db.exec(`set role authenticated`);
    await assert.rejects(
      () => db.exec("select * from beta_private.internal_qa_entities"),
      /permission/,
    );
  } finally {
    await db.close();
  }
});
