import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prizeItems,
  prizeSelection,
  competitionHref,
} from "../../src/core/prize-schedules";
import { weeklyCountdown } from "../../src/core/weekly-core";
test("prize selectors retain periods, modes, sport and seasons without invented weeks", () => {
  const competitions = ["SALARY_CAP", "OPEN"].flatMap((mode) =>
    ["2025", "2026"].flatMap((season) =>
      [1, 2].map((week) => ({
        id: `${mode}-${season}-${week}`,
        name: "Fixture",
        sport: "nfl",
        mode,
        season,
        week,
      })),
    ),
  );
  for (const mode of ["SALARY_CAP", "OPEN"])
    for (const period of ["weekly", "season"]) {
      const selected = prizeSelection(
        competitions,
        { mode, period, season: "2025", week: "1" },
        "nfl",
      );
      assert.equal(selected.mode, mode);
      assert.equal(selected.period, period);
      assert.equal(selected.round?.week, 1);
      assert.equal(selected.season, "2025");
      const href = competitionHref("/fantasy/results", {
        mode,
        period,
        season: "2025",
        week: "1",
        sport: "nfl",
      });
      assert.match(href, /season=2025/);
      assert.match(href, /sport=nfl/);
    }
  assert.equal(prizeSelection(competitions, {}, "football").round, undefined);
});
test("prize ranges and seconds display keep exact semantics", () => {
  const reward = {
    from: 1,
    to: 3,
    description: "Fixture only",
    type: "pack",
    amount: 1,
  };
  assert.equal(
    prizeItems.safeParse([reward, { ...reward, from: 3, to: 4 }]).success,
    false,
  );
  assert.equal(prizeItems.safeParse([{ ...reward, amount: 0 }]).success, false);
  assert.equal(
    prizeItems.safeParse([reward, { ...reward, from: 4, to: 10 }]).success,
    true,
  );
  const now = Date.parse("2026-10-19T00:00:00Z");
  assert.equal(
    weeklyCountdown(new Date(now + 90061000).toISOString(), now),
    "1d 1h 1m 1s",
  );
  assert.equal(
    weeklyCountdown(new Date(now - 1).toISOString(), now),
    "Checking your next pack…",
  );
});
