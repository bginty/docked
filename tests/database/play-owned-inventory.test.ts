import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";

for (const config of [
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
])
  test(`${config.label} Play reads and writes require settled owned cards, preserve snapshots and reject catalogue IDs`, async () => {
    const db = await multiSportDatabase(config, true);
    try {
      await db.pg
        .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
        create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`);
      await db.q(
        "insert into sports_feed.nba_beta_control values(true,true,'Isolated ownership test',clock_timestamp())",
      );
      for (const u of [db.user, db.other])
        await db.q(
          "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values($1,true,'Isolated ownership test','infinity')",
          [u],
        );
      await db.q(
        "update sports_feed.private_beta_sports set enabled=true,authority='Isolated ownership test'",
      );
      await db.q(
        "select set_config('docked.nba_private_beta','enabled',false),set_config('docked.sports_private_beta','enabled',false),set_config('docked.private_beta_sport',$1,false)",
        [config.id],
      );
      assert.equal(
        (await db.state()).cards.length,
        0,
        "Roster availability is not ownership",
      );

      const owned = db.inventories[db.user].slice(0, config.slots.length);
      const catalogue = db.inventories[db.user].at(-1)!;
      const unopened = { ...catalogue, id: randomUUID() };
      const foreign = { ...catalogue, id: randomUUID() };
      const wrongSport = { ...catalogue, id: randomUUID() };
      const missingRecord = { ...catalogue, id: randomUUID() };
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=cards||$1::jsonb where user_id=$2 and sport=$3",
        [[unopened, foreign, wrongSport, missingRecord], db.user, config.id],
      );
      const ledger: any = initialMemberTestCredits();
      ledger.economy = {
        instances: {},
        players: {},
        definitions: {},
        packs: {},
        products: {},
      };
      for (const card of [
        ...owned,
        unopened,
        foreign,
        wrongSport,
        missingRecord,
      ]) {
        const owner = card.id === foreign.id ? db.other : db.user;
        ledger.commerce.cards[card.id] = {
          owner,
          sport: card.id === wrongSport.id ? "nfl" : config.id,
          tier: card.tier,
          reserved: null,
        };
        if (card.id !== missingRecord.id)
          ledger.cards[card.id] = { owner, history: [{ to: owner, at: 1000 }] };
        ledger.economy.instances[card.id] = { source: card.id };
        ledger.entitlements[card.id] = {
          status: card.id === unopened.id ? "ALLOCATED" : "OPENED",
        };
      }
      await db.q("insert into credits_sandbox.state values(true,0,$1)", [
        ledger,
      ]);
      const before = JSON.stringify(
        (await db.q("select document from credits_sandbox.state"))[0],
      );
      const state = await db.state();
      assert.deepEqual(
        state.cards.map((c: any) => c.id).sort(),
        owned.map((c) => c.id).sort(),
      );
      const collection = (
        await db.q("select beta_fantasy.owned_collection_page($1) result", [
          { sport: config.id },
        ])
      )[0].result;
      assert.equal(collection.total, owned.length);
      assert.deepEqual(collection.counts, { CORE: owned.length });
      for (const card of [
        catalogue,
        unopened,
        foreign,
        wrongSport,
        missingRecord,
      ])
        await assert.rejects(
          db.command(
            "seven_draft",
            db.rounds.OPEN1,
            [{ slot: config.slots[0].id, card: card.id }],
            0,
          ),
          /Owned, opened, unlisted/,
        );
      const picks = sandboxRecommendation(state, db.rounds.OPEN1).picks;
      assert.equal(picks.length, config.slots.length);
      await db.command("seven_enter", db.rounds.OPEN1, picks, 0);
      const snapshot = (
        await db.q(
          "select snapshot from beta_fantasy.entries where competition_id=$1 and user_id=$2",
          [db.rounds.OPEN1, db.user],
        )
      )[0].snapshot;
      await db.q("select set_config('qa.now','2099-02-03T00:00:00Z',false)");
      await db.state();
      // Simulate unavailable current projection after a round locks, without changing ownership/history.
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards='[]' where user_id=$1 and sport=$2",
        [db.user, config.id],
      );
      const historical = await db.state();
      assert.equal(historical.cards.length, 0);
      assert.deepEqual(
        historical.entries.find(
          (e: any) => e.competition_id === db.rounds.OPEN1,
        ).snapshot,
        snapshot,
      );
      await assert.rejects(
        db.command("seven_enter", db.rounds.OPEN1, picks, 1),
        /closed at first kickoff/,
      );
      assert.equal(
        JSON.stringify(
          (await db.q("select document from credits_sandbox.state"))[0],
        ),
        before,
        "Selection and reads cannot change wallets or ownership",
      );
      await db.asUser(db.other);
      await assert.rejects(
        db.q("select sports_feed.lineup_inventory($1,$2)", [
          db.user,
          db.rounds.OPEN1,
        ]),
        /Isolated sport access/,
      );
      for (const role of [
        "anon",
        "authenticated",
        "service_role",
        "docked_app",
        "docked_beta_app",
      ])
        assert.equal(
          (
            await db.q(
              "select has_function_privilege($1,'sports_feed.owned_sport_inventory(uuid,text)','EXECUTE') ok",
              [role],
            )
          )[0].ok,
          false,
        );
    } finally {
      await db.pg.close();
    }
  });
