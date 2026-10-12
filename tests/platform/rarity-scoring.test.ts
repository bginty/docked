import { test } from "node:test";
import assert from "node:assert/strict";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";
import { nflRarityRules } from "../../src/core/scoring-v1";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
} from "../../src/core/scoring-engine";
import { createFreeBetaPeriod } from "../../src/core/free-beta-scoring";
test("rarity rules require a separate explicitly scoped future competition", () => {
  const f = syntheticScenario("nfl");
  const p = {
    ...f.state.period,
    id: "beta-real:nfl:rarity-test:contract",
    rules: nflRarityRules(),
    inventoryScope: "invited-nfl-test-v2" as const,
  };
  const evidence = {
    source: "https://example.invalid/fixture-only",
    verifiedAt: t.save,
    completeRound: true,
    lockPolicy: "whole-round-before-first-kickoff" as const,
    offsetSeconds: 0,
  };
  assert.equal(
    createFreeBetaPeriod(p, t.save, evidence).period.rules.version,
    "docked-nfl-rarity-test-v1",
  );
  assert.throws(
    () =>
      createFreeBetaPeriod(
        { ...p, inventoryScope: undefined },
        t.save,
        evidence,
      ),
    /configuration/,
  );
  assert.throws(
    () =>
      createFreeBetaPeriod(
        { ...p, id: "beta-real:nfl:existing-free" },
        t.save,
        evidence,
      ),
    /configuration/,
  );
  assert.throws(
    () =>
      createFreeBetaPeriod(p, t.final, { ...evidence, verifiedAt: t.final }),
    /started/,
  );
});
test("new rules lock rarity, preserve old periods, apply corrections and negative totals", () => {
  const f = syntheticScenario("nfl");
  const catalogue = f.catalog.map((c) => ({ ...c, rarity: "ICON" as const }));
  const p = {
    ...f.state.period,
    rules: nflRarityRules(),
    id: "sim:nfl:rarity-test",
  };
  let s = createPeriod(p, t.created);
  for (const member of ["amber", "violet"])
    s = saveTeam(
      s,
      member,
      member,
      catalogue.filter((c) => c.owner === member).map((c) => c.cardId),
      catalogue,
      t.save,
    );
  assert.throws(
    () =>
      saveTeam(
        s,
        "amber",
        "duplicate",
        Array(7).fill(catalogue[0].cardId),
        catalogue,
        t.save,
      ),
    /duplicates/,
  );
  s = lockTeams(s, catalogue, t.lock);
  assert.equal(s.entries[0].cards[0].multiplierTenths, 15);
  const source = structuredClone(f.source);
  (source.players[0].stats as Record<string, number>).passing_yards = -25;
  s = importStatistics(s, source, { id: "test", role: "importer" }, t.initial);
  const r = results(s).rows.find((x) => x.member === "amber")!;
  assert.equal(r.players[0].baseCentipoints, -100);
  assert.equal(r.players[0].centipoints, -150);
  catalogue[0].owner = "another";
  assert.equal(
    results(s).rows.find((x) => x.member === "amber")!.players[0].centipoints,
    -150,
  );
  const correction = structuredClone(source);
  correction.revision = 2;
  correction.observedAt = t.corrected;
  (correction.players[0].stats as Record<string, number>).passing_yards = -50;
  const fixed = importStatistics(
    s,
    correction,
    { id: "test", role: "importer" },
    t.corrected,
  );
  assert.equal(
    results(fixed).rows.find((x) => x.member === "amber")!.players[0]
      .centipoints,
    -300,
  );
  assert.equal(s.sources.length, 1);
  assert.equal(fixed.sources.length, 2);
  const tampered = structuredClone(s);
  tampered.entries[0].cards[0].multiplierTenths = 10;
  assert.throws(() => results(tampered), /snapshot/);
  assert.equal(f.state.period.rules.rarityVersion, undefined);
});
