import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nrlConfiguration,
  nbaConfiguration,
  nbaWeeklyConfiguration,
  eplConfiguration,
} from "../../src/core/sport-configuration";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import { createPeriod, digest, results } from "../../src/core/scoring-engine";
import { nrlStats, nbaStats } from "../../src/core/additional-sport-statistics";
import type { Rules } from "../../src/core/scoring-v1";
for (const sport of [
  nrlConfiguration,
  nbaConfiguration,
  nbaWeeklyConfiguration,
  eplConfiguration,
])
  test(`${sport.label}: persisted slots, modes, rollover and historical privacy use the shared command`, async () => {
    const db = await multiSportDatabase(sport);
    try {
      if (sport.id === "nrl" || sport.id === "basketball") {
        const scoringSport = sport.id;
        const rules: Rules = {
          sport: scoringSport,
          version: `qa-${scoringSport}-journal-v1`,
          title: "Synthetic journal only",
          beta: true,
          slots: sport.slots,
          positions: [...new Set(sport.slots.flatMap((s) => s.positions))],
          weights: Object.fromEntries(
            Object.keys(
              scoringSport === "nrl" ? nrlStats.shape : nbaStats.shape,
            ).map((k) => [k, 1]),
          ),
          correctionHours: 72,
          periodName: "QA",
          policy: ["Not approved scoring"],
        };
        const s = createPeriod(
          {
            id: `sim:${scoringSport}:journal`,
            sport: scoringSport,
            label: "QA",
            locksAt: "2099-02-01T00:00:00Z",
            window: {
              start: "2099-02-01T00:00:00Z",
              end: "2099-02-08T00:00:00Z",
              timezone: "UTC",
            },
            rules,
            fixtures: [
              {
                id: `sim:${scoringSport}:game`,
                scheduledAt: "2099-02-02T00:00:00Z",
                playerIds: ["qa:player"],
              },
            ],
          },
          "2099-01-01T00:00:00Z",
        );
        await db.q("insert into scoring_beta.rules values($1,$2,$3,$4)", [
          rules.version,
          scoringSport,
          digest(rules),
          JSON.stringify(rules),
        ]);
        await db.q(
          "insert into scoring_beta.streams(id,sport,rules_version) values($1,$2,$3)",
          [s.period.id, scoringSport, rules.version],
        );
        await db.q(
          "insert into scoring_beta.journal(stream_id,revision,previous_hash,state_hash,body,calculated)values($1,1,'',$2,$3,$4)",
          [
            s.period.id,
            digest(s),
            JSON.stringify(s),
            JSON.stringify(results(s)),
          ],
        );
        const row = (
          await db.q(
            "select body,calculated from scoring_beta.journal where stream_id=$1",
            [s.period.id],
          )
        )[0];
        assert.deepEqual(results(row.body), row.calculated);
        await assert.rejects(
          db.q("delete from scoring_beta.journal where stream_id=$1", [
            s.period.id,
          ]),
          /append only/,
        );
        assert.equal(
          (
            await db.q(
              "select has_table_privilege('docked_beta_app','scoring_beta.journal','INSERT') ok",
            )
          )[0].ok,
          false,
        );
      }
      const state = await db.state(),
        id = db.rounds.OPEN1;
      const recommended = sandboxRecommendation(state, id);
      assert.equal(recommended.picks.length, sport.slots.length);
      if (sport.period !== "round") {
        const [row] = await db.q(
          "select fixtures from sports_feed.sport_rounds where competition_id=$1",
          [id],
        );
        await db.q(
          "update sports_feed.sport_rounds set fixtures=$1 where competition_id=$2",
          [
            JSON.stringify([
              ...row.fixtures,
              {
                ...row.fixtures[0],
                fixtureId: "qa:second-game",
                scheduledAt: "2099-02-04T00:00:00Z",
              },
            ]),
            id,
          ],
        );
      }
      await db.command("seven_enter", id, recommended.picks, 0);
      const after = await db.state();
      const snap = after.entries[0].snapshot;
      assert.equal(snap.length, sport.slots.length);
      if (sport.period !== "round") assert.equal(snap[0].fixture_ids.length, 2);
      assert.throws(() => sandboxRecommendation(after, id), /established/);
      assert.deepEqual(
        after.drafts.find((d: any) => d.competition_id === db.rounds.OPEN2)
          .selections,
        recommended.picks,
      );
      assert.equal(
        after.drafts.some(
          (d: any) => d.competition_id === db.rounds.SALARY_CAP2,
        ),
        false,
      );
      await db.asUser(db.other);
      assert.equal((await db.state()).entries.length, 0);
      await db.asUser(db.user);
      await db.q("select set_config('qa.now','2099-02-01T00:00:01Z',false)");
      await assert.rejects(
        db.command("seven_draft", id, recommended.picks, 0),
        /closed/,
      );
      assert.deepEqual((await db.state()).entries[0].snapshot, snap);
    } finally {
      await db.pg.close();
    }
  });
