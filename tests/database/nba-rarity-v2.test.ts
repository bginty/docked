import { test } from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { seedNbaJournal } from "../fixtures/nba-weekly-journal";
import { nbaWeeklyConfiguration } from "../../src/core/sport-configuration";
import { nbaRarityWeeklyVersion } from "../../src/core/additional-sport-statistics";
test("NBA V2 SQL snapshots, post-lock visibility and corrected contributions reconcile", async () => {
  const db = await multiSportDatabase(
    nbaWeeklyConfiguration,
    false,
    nbaRarityWeeklyVersion,
  );
  try {
    for (const who of [db.user, db.other]) {
      const cards = db.inventories[who].map((c) => ({
        ...c,
        tier: who === db.user ? "LEGENDARY" : "CORE",
        multiplierTenths: 10,
      }));
      await db.q(
        "update sports_feed.sport_sandbox_inventory set cards=$1 where user_id=$2 and sport='basketball'",
        [JSON.stringify(cards), who],
      );
      await db.asUser(who);
      await db.command(
        "seven_enter",
        db.rounds.OPEN1,
        db.config.slots.map((s, i) => ({ slot: s.id, card: cards[i].id })),
        0,
      );
      assert.equal((await db.state()).entries.length, 1);
    }
    await db.asUser(db.user);
    await db.q("select set_config('qa.now','2099-02-01T04:00:00Z',false)");
    const journal = await seedNbaJournal(db);
    await journal.importGame();
    const view = await journal.read(),
      rows = view.scores[db.rounds.OPEN1].rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].user_id, db.user);
    for (const r of rows)
      assert.equal(
        r.points,
        r.players.reduce((n: number, p: any) => n + (p.points ?? 0), 0),
      );
    assert.equal(rows[0].players.find((p: any) => p.points)?.points, 7742);
    const before = rows[0].points;
    await journal.importGame(2);
    assert.ok(
      (await journal.read()).scores[db.rounds.OPEN1].rows[0].points! > before!,
    );
  } finally {
    await db.pg.close();
  }
});
