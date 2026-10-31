import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import { approvedAustralianLineup } from "../../src/core/approved-australian-rules";
import { sevenIssues } from "../../src/core/nfl-seven";

for (const sport of [aflConfiguration, nrlConfiguration])
  test(`${sport.label}: free Core is round eligibility, not collectible issuance`, async () => {
    const d = await multiSportDatabase(sport, false, undefined, true);
    try {
      const cid = d.rounds.OPEN1;
      const eligible = () =>
        d.q("select sports_feed.free_core_inventory($1,$2) cards", [
          d.user,
          cid,
        ]);
      assert.deepEqual((await eligible())[0].cards, []);
      const originals = d.inventories[d.user];
      for (const c of originals) {
        await d.q(
          `insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season) values($1,$2,$3,$4,$5,'#1759a3',1,'2099')`,
          [c.player_id, c.name, sport.id, c.position, c.team],
        );
        await d.q(
          `insert into sports_feed.free_core_roster values($1,$2,'2099',$3,'2099-03-01','https://example.invalid/isolated-roster',$4,true)`,
          [
            c.player_id,
            sport.id,
            JSON.stringify(c.eligible_positions),
            "a".repeat(64),
          ],
        );
      }
      // No collectible inventory for this member. Programme and each round opt in separately.
      await d.q(
        "update sports_feed.sport_sandbox_inventory set cards='[]' where user_id=$1",
        [d.user],
      );
      await d.q(
        "update sports_feed.free_core_programmes set enabled=true where sport=$1",
        [sport.id],
      );
      const cards = (await eligible())[0].cards;
      assert.equal(cards.length, sport.slots.length + 1);
      assert.ok(
        cards.every(
          (c: any) =>
            c.collectible_owned === false &&
            c.serial === null &&
            c.tier === "CORE" &&
            !c.tradeable,
        ),
      );
      assert.deepEqual(
        (
          await d.q("select sports_feed.free_core_inventory($1,$2) cards", [
            d.other,
            cid,
          ])
        )[0].cards,
        [],
      );
      assert.deepEqual(
        (
          await d.q("select sports_feed.free_core_inventory($1,$2) cards", [
            d.user,
            d.rounds.OPEN3,
          ])
        )[0].cards,
        [],
      );
      const state = await d.state();
      assert.equal(state.cards.length, cards.length);
      assert.ok(
        state.cards.every((c: any) => c.eligible_competition_ids.length === 4),
      );
      const proposal = sandboxRecommendation(state, cid);
      assert.equal(proposal.picks.length, sport.slots.length);
      const approved = approvedAustralianLineup(sport.id as "afl" | "nrl");
      const traditional = await d.state();
      const freeTeam = sandboxRecommendation(traditional, d.rounds.SALARY_CAP1);
      const budget = sevenIssues(
        "SALARY_CAP",
        freeTeam.picks,
        traditional.cards,
        true,
        approved,
      );
      assert.equal(budget.total, sport.slots.length * 500000);
      assert.deepEqual(budget.errors, []);
      await d.command("seven_draft", d.rounds.SALARY_CAP1, freeTeam.picks, 0);
      await d.command("seven_enter", d.rounds.SALARY_CAP1, freeTeam.picks, 0);
      await d.command("seven_draft", cid, proposal.picks, 0);
      await d.command("seven_enter", cid, proposal.picks, 0);
      assert.equal(
        (await d.state()).entries[0].snapshot.length,
        sport.slots.length,
      );
      assert.equal(
        (
          await d.q(
            "select count(*)::int n from beta_fantasy.cards where owner_id=$1",
            [d.user],
          )
        )[0].n,
        0,
      );
      const duplicate = proposal.picks.map((p: any, i: number) =>
        i === 1 ? { ...p, card: proposal.picks[0].card } : p,
      );
      await assert.rejects(
        d.command("seven_enter", d.rounds.OPEN2, duplicate, 0),
      );
      await assert.rejects(
        d.command("seven_enter", d.rounds.OPEN3, proposal.picks, 0),
      );
      await d.asUser(d.other);
      await assert.rejects(d.command("seven_enter", cid, proposal.picks, 0));
      await d.asUser(d.user);
      await d.q(
        "update sports_feed.free_core_roster set active=false where player_id=$1",
        [
          cards.find((c: { id: string }) => c.id === proposal.picks[0].card)
            .player_id,
        ],
      );
      await assert.rejects(
        d.command("seven_enter", d.rounds.OPEN2, proposal.picks, 0),
      );
      await d.q("select set_config('qa.now','2099-02-02T01:00:00Z',false)");
      assert.deepEqual((await eligible())[0].cards, []);
      assert.equal(
        (await d.state()).entries[0].snapshot.length,
        sport.slots.length,
      );
      await assert.rejects(
        d.q(
          "update sports_feed.free_core_programmes set sport='basketball' where sport=$1",
          [sport.id],
        ),
      );
      assert.equal(
        (
          await d.q(
            "select has_table_privilege('docked_beta_app','sports_feed.free_core_programmes','UPDATE') allowed",
          )
        )[0].allowed,
        false,
      );
    } finally {
      await d.pg.close();
    }
  });
