import test from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
import { approvedAustralianPrizes } from "../../src/core/approved-australian-rules";
import {
  fulfillRoundReward,
  roundRewardPlan,
  type RoundRewardContext,
} from "../../src/core/round-rewards";
import { executeCredits } from "../../src/core/credits-sandbox";
import { rarityConfiguration } from "../../src/core/card-rarity";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";

test("Isolated round rewards persist through database supply guards and preserve unopened receipts", async () => {
  for (const sport of ["afl", "nrl"] as const) {
    const db = await multiSportDatabase(
      sport === "afl" ? aflConfiguration : nrlConfiguration,
      true,
    );
    try {
      // Same isolated transport identities as the existing economy acceptance suite.
      await db.pg
        .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
        create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
        create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`);
      await db.q(
        "insert into sports_feed.nba_beta_control values(true,true,'Isolated reward test',now())",
      );
      await db.q(
        "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Isolated reward test','infinity')",
        [db.user],
      );
      await db.q(
        "select set_config('docked.nba_private_beta','enabled',false),set_config('docked.private_beta_sport',$1,false),set_config('docked.sports_private_beta','enabled',false)",
        [sport],
      );
      await db.q(
        "update sports_feed.private_beta_sports set enabled=true where sport=$1",
        [sport],
      );
      let state = packFixture(sport);
      const member = { ...packMember, id: db.user };
      state = JSON.parse(
        JSON.stringify(state).replaceAll(packMember.id, member.id),
      );
      Object.values(state.economy!.players).forEach((p) => {
        p.fixturePlayerId = randomUUID();
      });
      // Each sport uses an isolated fixture database row; no production connection.
      const policy = approvedAustralianPrizes(sport, "SALARY_CAP");
      const product = Object.values(state.economy!.products).find(
        (p) => p.sport === sport && p.cards === 9 && p.type === "STANDARD",
      )!;
      policy.items.forEach((p) => {
        if (p.type === "pack") p.productVersion = product.id;
      });
      const context: RoundRewardContext = {
        competition: `fixture-${sport}`,
        round: "one",
        sport,
        member: member.id,
        place: 2,
        revision: 1,
        final: true,
        complete: true,
        eligible: true,
        tied: false,
        schedule: { ...policy, active: true, tiePolicy: "hold" },
      };
      // The transport fixture is seeded before allocation, with unchanged SQL guards.
      await db.q(
        "insert into credits_sandbox.rarity_configuration values($1,$2) on conflict do nothing",
        [rarityConfiguration.version, rarityConfiguration],
      );
      for (const player of Object.values(state.economy!.players))
        await db.q(
          "insert into credits_sandbox.nba_fixture_players values($1,$2)",
          [player.id, player],
        );
      for (const product of Object.values(state.economy!.products))
        await db.q(
          "insert into credits_sandbox.pack_configuration values($1,$2)",
          [product.version, product],
        );
      await db.q("insert into credits_sandbox.state values(true,0,$1)", [
        state,
      ]);
      const plan = roundRewardPlan(context);
      for (const reward of plan) {
        state = fulfillRoundReward(
          state,
          { id: "isolated-owner", role: "reviewer", aal: "aal2" },
          context,
          reward.id,
          packNow,
        ).state;
        await db.q(
          "update credits_sandbox.state set document=$1,revision=revision+1 where id",
          [state],
        );
      }
      assert.equal(Object.keys(state.entitlements).length, 5);
      const first = plan[1].id;
      state = executeCredits(
        state,
        member,
        "isolated-open",
        { kind: "open-pack", entitlement: first },
        packNow,
      ).state;
      await db.q("update credits_sandbox.state set document=$1 where id", [
        state,
      ]);
      const saved = (
        await db.q("select document from credits_sandbox.state where id")
      )[0].document;
      assert.equal(saved.entitlements[first].status, "OPENED");
      assert.equal(
        Object.values(saved.entitlements).filter(
          (e: any) => e.status === "SEALED",
        ).length,
        4,
      );
      assert.equal(Object.keys(saved.roundRewards).length, 6);
    } finally {
      await db.pg.close();
    }
  }
});
