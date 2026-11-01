import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";

for (const sport of [aflConfiguration, nrlConfiguration]) {
  test(`${sport.label}: verified registry free-Core adapter preserves ownership and fails closed`, async () => {
    const d = await multiSportDatabase(sport, false, undefined, true);
    try {
      // Reapplying the additive migration must not recursively wrap the function.
      await d.pg.exec(
        await readFile(
          "supabase/migrations/20261101090955_free_core_verified_roster_adapter.sql",
          "utf8",
        ),
      );
      // Replay restores production clock calls; reapply this fixture's clock only.
      await d.pg.exec(
        `do $$begin execute replace(pg_get_functiondef('sports_feed.free_core_inventory(uuid,uuid)'::regprocedure),'clock_timestamp()','qa.now()');end$$;`,
      );
      const sourceHash = "a".repeat(64),
        originals = d.inventories[d.user];
      for (const [i, c] of originals.entries()) {
        const qid = `Q${900000 + i}`,
          id = `${sport.id}-roster-beta-${qid}`;
        const identity = {
          id,
          provider: "wikimedia",
          providerId: `${sport.id}:${qid}`,
          assetKind: "player",
          inventoryClass: "real-roster-beta-v1",
          synthetic: false,
          sport: sport.id,
          name: c.name,
          currentTeam: c.team,
          position: c.position,
          eligiblePositions: c.eligible_positions,
          status: "active",
          fixturePlayerId: c.player_id,
          verifiedJerseyNumber: null,
          rosterBeta: {
            wikidataId: qid,
            canonicalPlayerId: c.player_id,
            sourceHash,
            license: "CC-BY-SA-4.0",
            verification: "roster-and-profile-agreement",
            permanentIssuanceEligible: false,
            rosterSource: "https://en.wikipedia.org/Isolated_test_fixture",
            profileSource: "https://en.wikipedia.org/Isolated_test_fixture",
            verifiedAt: "2099-01-01T00:00:00Z",
          },
        };
        await d.q(
          "insert into credits_sandbox.nba_fixture_players(id,identity) values($1,$2)",
          [id, JSON.stringify(identity)],
        );
        await d.q(
          "insert into sports_feed.free_core_roster_beta values($1,$2,'2099',$3,'2099-03-01',$4,true)",
          [id, sport.id, JSON.stringify(c.eligible_positions), sourceHash],
        );
      }
      await d.q(
        "update sports_feed.sport_sandbox_inventory set cards='[]' where user_id=$1",
        [d.user],
      );
      const cards = async () =>
        (
          await d.q("select sports_feed.free_core_inventory($1,$2) cards", [
            d.user,
            d.rounds.OPEN1,
          ])
        )[0].cards;
      assert.deepEqual(await cards(), []);
      await d.q(
        "update sports_feed.free_core_programmes set enabled=true where sport=$1",
        [sport.id],
      );
      const available = await cards();
      assert.equal(available.length, sport.slots.length + 1);
      assert(
        available.every(
          (c: any) =>
            c.collectible_owned === false &&
            c.serial === null &&
            !c.tradeable &&
            c.verifiedJerseyNumber === null,
        ),
      );
      const state = await d.state(),
        team = sandboxRecommendation(state, d.rounds.OPEN1);
      assert.equal(team.picks.length, sport.slots.length);
      await d.command("seven_draft", d.rounds.OPEN1, team.picks, 0);
      await d.command("seven_enter", d.rounds.OPEN1, team.picks, 0);
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
      assert.equal(
        (
          await d.q(
            "select jsonb_array_length(cards)::int n from sports_feed.sport_sandbox_inventory where user_id=$1 and sport=$2",
            [d.user, sport.id],
          )
        )[0].n,
        0,
      );
      await d.asUser(d.other);
      assert.deepEqual(await cards(), []);
      await d.asUser(d.user);
      // Operator evidence and positions must agree with the authoritative registry.
      await d.q(
        "update sports_feed.free_core_roster_beta set source_hash=repeat('b',64)",
      );
      assert.deepEqual(await cards(), []);
      await d.q("update sports_feed.free_core_roster_beta set source_hash=$1", [
        sourceHash,
      ]);
      await d.q(
        "update sports_feed.free_core_roster_beta set eligible_positions=eligible_positions || '[\"QB\"]'::jsonb",
      );
      assert.deepEqual(await cards(), []);
      await d.q(
        "update sports_feed.free_core_roster_beta r set eligible_positions=p.identity->'eligiblePositions' from credits_sandbox.nba_fixture_players p where p.id=r.provider_player_id",
      );
      await d.q(
        "update sports_feed.free_core_roster_beta set valid_until='2098-01-01'",
      );
      assert.deepEqual(await cards(), []);
      await d.q(
        "update sports_feed.free_core_roster_beta set valid_until='2099-03-01'",
      );
      // OPEN3 was created without free-Core opt-in; saved rules are immutable.
      await assert.rejects(
        d.command("seven_enter", d.rounds.OPEN3, team.picks, 0),
      );
      await d.q("select set_config('qa.now','2099-02-02T01:00:00Z',false)");
      assert.deepEqual(await cards(), []);
      assert.equal(
        (await d.state()).entries[0].snapshot.length,
        sport.slots.length,
      );
      assert.equal(
        (
          await d.q(
            "select has_table_privilege('docked_beta_app','sports_feed.free_core_roster_beta','SELECT') allowed",
          )
        )[0].allowed,
        false,
      );
    } finally {
      await d.pg.close();
    }
  });
}
