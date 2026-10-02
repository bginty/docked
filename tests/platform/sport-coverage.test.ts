import { test } from "node:test";
import assert from "node:assert/strict";
import { sportCoverage } from "../../src/core/sport-coverage";
import { sports, leagues } from "../../src/content/sports";
import { articles } from "../../src/content/articles";
import { strategyV1 } from "../../src/core/pricing";
test("visual sport coverage follows configured competitions and never implies live validation", () => {
  const research = sports
    .filter(
      (s) =>
        sportCoverage(s.slug, strategyV1.competitions).status === "RESEARCH",
    )
    .map((s) => s.slug);
  assert.deepEqual(research, ["football", "basketball"]);
  for (const sport of sports)
    assert.equal(sportCoverage(sport.slug, []).status, "COMING SOON");
  assert.equal(
    sportCoverage("basketball", ["soccer_epl"]).status,
    "COMING SOON",
  );
  assert.equal(
    sportCoverage("football", ["soccer_epl"]).competitions.length,
    1,
  );
  assert.equal(
    sportCoverage("tennis", ["unimplemented_tennis"]).status,
    "COMING SOON",
  );
  for (const sport of sports)
    assert.notEqual(
      sportCoverage(sport.slug, strategyV1.competitions).status as string,
      "LIVE",
    );
});
test("ten sport pages have substantive distinct rules, valid reading links and canonical league links", () => {
  assert.equal(sports.length, 10);
  assert.equal(new Set(sports.map((s) => s.slug)).size, 10);
  for (const sport of sports) {
    assert.ok(sport.sections.length >= 3);
    assert.ok(
      sport.sections
        .map(([, text]) => text)
        .join(" ")
        .split(/\s+/).length >= 140,
    );
    assert.ok(
      articles.some((a) => a.slug === sport.related),
      `${sport.slug} related article exists`,
    );
  }
  assert.ok(sports.some((s) => s.slug === "basketball"));
  assert.ok(!sports.some((s) => (s.slug as string) === "nba"));
  for (const league of leagues)
    assert.ok(sports.some((s) => s.slug === league.sport));
});
