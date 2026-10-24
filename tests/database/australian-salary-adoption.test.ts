import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import {
  approvedAustralianLineup,
  approvedAustralianPrizes,
} from "../../src/core/approved-australian-rules";
test("Approved salary versions install additively and only explicitly adopt empty future rounds", async () => {
  for (const sport of [aflConfiguration, nrlConfiguration]) {
    const db = await multiSportDatabase(sport);
    try {
      const read = async (id: string) =>
        (
          await db.q(
            "select rules,prize from beta_fantasy.competitions where id=$1",
            [id],
          )
        )[0];
      const id = db.rounds.SALARY_CAP1,
        old = await read(id),
        config = approvedAustralianLineup(sport.id as "afl" | "nrl");
      const loaded = (
        await db.q(
          "select configuration from beta_fantasy.lineup_configurations where version=$1",
          [config.version],
        )
      )[0].configuration;
      assert.deepEqual(loaded, config);
      assert.equal(old.rules.lineup_version, db.config.version);
      await assert.rejects(
        db.q("select sports_feed.adopt_australian_salary($1,$2)", [
          id,
          "Reviewed isolated transition",
        ]),
        /MFA/,
      );
      await db.q(
        "insert into beta_private.roles(user_id,role)values($1,'owner')",
        [db.user],
      );
      const selections = db.config.slots.map((slot, i) => ({
        slot: slot.id,
        card: db.inventories[db.user][i].id,
      }));
      await db.command("seven_draft", db.rounds.SALARY_CAP2, selections, 0);
      await assert.rejects(
        db.q("select sports_feed.adopt_australian_salary($1,$2)", [
          db.rounds.SALARY_CAP2,
          "Reviewed isolated transition",
        ]),
        /drafts require review/,
      );
      await db.q("select sports_feed.adopt_australian_salary($1,$2)", [
        id,
        "Reviewed isolated transition",
      ]);
      assert.equal((await read(id)).rules.lineup_version, config.version);
      assert.equal((await read(id)).prize, old.prize);
      assert.equal(
        (await read(db.rounds.SALARY_CAP2)).rules.lineup_version,
        db.config.version,
      );
      // Exact and excessive budgets exercise the actual SQL submission validator.
      const cards = structuredClone(db.inventories[db.user]);
      cards.forEach(
        (c, i) =>
          (c.tier = i < (sport.id === "afl" ? 16 : 9) ? "RARE" : "ULTRA_RARE"),
      );
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
        [JSON.stringify(cards), db.user, sport.id],
      );
      await db.command("seven_draft", id, selections, 0);
      cards[0].tier = "ELITE";
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
        [JSON.stringify(cards), db.user, sport.id],
      );
      await assert.rejects(
        db.command("seven_enter", id, selections, 0),
        /cap|salary|budget/i,
      );
      cards[0].tier = "RARE";
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport=$3",
        [JSON.stringify(cards), db.user, sport.id],
      );
      await db.command("seven_enter", id, selections, 0);
      await assert.rejects(
        db.q("select sports_feed.adopt_australian_salary($1,$2)", [
          id,
          "Must preserve confirmed entry",
        ]),
        /entries and drafts require review/,
      );
      for (const mode of ["SALARY_CAP", "OPEN"] as const) {
        const expected = approvedAustralianPrizes(
          sport.id as "afl" | "nrl",
          mode,
        );
        for (const item of expected.items.filter((i) => i.type === "pack"))
          await db.q(
            "insert into credits_sandbox.pack_configuration values($1,$2) on conflict do nothing",
            [item.productVersion, { sport: sport.id }],
          );
        assert.deepEqual(
          (
            await db.q(
              "select configuration from sports_feed.australian_prize_rules where version=$1",
              [expected.version],
            )
          )[0].configuration,
          expected,
        );
        await db.q("select beta_fantasy.validate_prizes($1)", [expected.items]);
        await assert.rejects(
          db.q(
            "select beta_fantasy.save_prize_schedule($1,'weekly',$2,true,0,'Isolated blocked activation')",
            [db.rounds[mode + "3"], expected.items],
          ),
          /tie policy/,
        );
        await db.q(
          "select beta_fantasy.save_prize_schedule($1,'weekly',$2,false,0,'Isolated reviewed draft')",
          [db.rounds[mode + "3"], expected.items],
        );
      }
      assert.equal(
        (
          await db.q(
            "select count(*)::int n from beta_private.audit_events where action='future_salary_adopted'",
          )
        )[0].n,
        1,
      );
    } finally {
      await db.pg.close();
    }
  }
});
