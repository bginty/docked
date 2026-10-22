import { test } from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { seedNbaJournal } from "../fixtures/nba-weekly-journal";
import { nbaWeeklyConfiguration } from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import {
  sandboxScoreView,
  sandboxHistoricalRanks,
} from "../../src/core/sandbox-score-view";
test("NBA isolated journal: real SQL lock/privacy, exact snapshots, corrections and least privilege", async () => {
  const db = await multiSportDatabase(nbaWeeklyConfiguration);
  try {
    const id = db.rounds.OPEN1;
    const canonical = db.inventories[db.user].map((c, i) => ({
      ...c,
      canonical_player_id:
        i === 7 ? db.inventories[db.user][0].player_id : c.player_id,
    }));
    await db.q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport='basketball'",
      [JSON.stringify(canonical), db.user],
    );
    await assert.rejects(
      db.command(
        "seven_enter",
        db.rounds.OPEN3,
        db.config.slots.map((s, i) => ({ slot: s.id, card: canonical[i].id })),
        0,
      ),
      /underlying player/,
    );
    await db.q(
      "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport='basketball'",
      [JSON.stringify(db.inventories[db.user]), db.user],
    );
    for (const who of [db.user, db.other]) {
      await db.asUser(who);
      const s = await db.state();
      const picks = sandboxRecommendation(s, id).picks;
      await db.command("seven_draft", id, picks, 0);
      assert.throws(
        () =>
          sandboxRecommendation(
            { ...s, drafts: [{ competition_id: id, selections: picks }] },
            id,
          ),
        /Draft already saved/,
      );
      await db.command("seven_enter", id, picks, 0);
    }
    assert.deepEqual(
      (await db.q("select sports_feed.sandbox_nba_journals() j"))[0].j,
      [],
    );
    await db.asUser(db.user);
    assert.equal((await db.state()).entries.length, 1);
    await db.q("select set_config('qa.now','2099-02-01T04:00:00Z',false)");
    const journal = await seedNbaJournal(db);
    await journal.importGame();
    const view = await journal.read();
    assert.equal(view.scores[id].rows.length, 2);
    for (const row of view.scores[id].rows) {
      const snapshot = view.entries.find(
        (e: any) => e.competition_id === id && e.user_id === row.user_id,
      ).snapshot;
      assert.equal(
        row.points,
        row.players.reduce((n: number, p: any) => n + (p.points ?? 0), 0),
      );
      for (const p of row.players)
        assert.ok(
          snapshot.some(
            (c: any) => c.card_id === p.card_id && c.slot === p.slot,
          ),
        );
    }
    const before = view.scores[id].rows.find(
      (r: any) => r.user_id === db.user,
    )!.points!;
    await journal.importGame(2);
    assert.ok(
      (await journal.read()).scores[id].rows.find(
        (r: any) => r.user_id === db.user,
      )!.points! > before,
    );
    const j = (await db.q("select sports_feed.sandbox_nba_journals() j"))[0].j;
    const future = {
      ...view.competitions.find((c: any) => c.id === id),
      id: "future-qa",
      locks_at: "2099-02-08T00:00:00Z",
    };
    const ranks = sandboxHistoricalRanks(
      { ...view, competitions: [...view.competitions, future] },
      j,
    );
    assert.deepEqual(ranks[id], {});
    assert.ok(Object.values(ranks[future.id]).length > 0);
    assert.ok(Object.values(ranks[future.id]).every((n) => n === 5730));
    assert.throws(
      () =>
        sandboxScoreView(
          {
            ...view,
            entries: view.entries.map((e: any) => ({
              ...e,
              snapshot: e.snapshot.map((c: any) => ({ ...c, slot: "WRONG" })),
            })),
          },
          j,
        ),
      /snapshot disagree/,
    );
    await db.q("select set_config('request.jwt.claims','{}',false)");
    await assert.rejects(
      db.q("select sports_feed.sandbox_nba_journals()"),
      /MFA/,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.equal(
        (
          await db.q(
            "select has_function_privilege($1,'sports_feed.sandbox_nba_journals()','EXECUTE') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
    }
    assert.equal(
      (
        await db.q(
          "select has_table_privilege('docked_beta_app','scoring_beta.journal','INSERT') allowed",
        )
      )[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.q(
          "select has_table_privilege('docked_beta_app','scoring_beta.journal','SELECT') allowed",
        )
      )[0].allowed,
      false,
    );
  } finally {
    await db.pg.close();
  }
});
