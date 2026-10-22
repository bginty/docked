import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { seedNbaJournal } from "../fixtures/nba-weekly-journal";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import { sportEventRules } from "../../src/core/sport-event-rules";

for (const config of [aflConfiguration, nrlConfiguration])
  test(`${config.label} journal, saved slots, DNP and corrections reconcile without frontend totals`, async () => {
    const rules = sportEventRules(config.id as "afl" | "nrl");
    const db = await multiSportDatabase(config, false, rules.version);
    try {
      for (const member of [db.user, db.other]) {
        await db.asUser(member);
        const s = await db.state();
        await db.command(
          "seven_enter",
          db.rounds.OPEN1,
          sandboxRecommendation(s, db.rounds.OPEN1).picks,
          0,
        );
      }
      await db.asUser(db.user);
      await db.q("select set_config('qa.now','2099-02-02T05:00:00Z',false)");
      const journal = await seedNbaJournal(db);
      await db.q("select set_config('qa.now','2099-01-01T00:00:00Z',false)");
      assert.deepEqual(
        (await journal.read()).scores,
        {},
        "pre-lock journals remain private",
      );
      await db.q("select set_config('qa.now','2099-02-02T05:00:00Z',false)");
      const pending = (await journal.read()).scores[db.rounds.OPEN1];
      assert(pending.rows.every((r) => r.points === null && r.completed === 0));
      await journal.importGame();
      const first = (await journal.read()).scores[db.rounds.OPEN1];
      for (const row of first.rows) {
        assert.equal(row.players.length, config.slots.length);
        assert.equal(row.completed, config.slots.length);
        assert.equal(
          row.points,
          row.players.reduce((n, p) => n + (p.points ?? 0), 0),
        );
        assert.deepEqual(
          row.players.map((p) => p.slot).sort(),
          config.slots.map((s) => s.id).sort(),
        );
      }
      const dnp = first.rows
        .flatMap((r) => r.players)
        .find((p) => p.status === "DNP");
      assert(dnp);
      assert.equal(dnp.points, 0);
      await journal.importGame(2);
      const corrected = (await journal.read()).scores[db.rounds.OPEN1];
      for (const row of corrected.rows) {
        assert.equal(
          row.points,
          first.rows.find((r) => r.user_id === row.user_id)!.points! * 2,
        );
        assert.equal(
          row.rank,
          first.rows.find((r) => r.user_id === row.user_id)!.rank,
        );
      }
      assert.equal(corrected.final, false);
      await db.asUser(db.other);
      assert.deepEqual(
        (await journal.read()).scores,
        { [db.rounds.OPEN1]: corrected },
        "competitors receive identical authoritative scores",
      );
    } finally {
      await db.pg.close();
    }
  });
