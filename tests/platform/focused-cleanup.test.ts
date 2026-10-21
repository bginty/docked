import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  memberAccessFailure,
  memberReturnPath,
} from "../../src/core/member-access-recovery";
import { mfaDestination } from "../../src/core/mfa-flow";
import { marketQuery, marketplaceView } from "../../src/core/marketplace";
import { rarities, rarityLabel } from "../../src/core/card-rarity";
import {
  prizeRewardLabel,
  finishingPosition,
} from "../../src/core/prize-schedules";
import { prizePackProduct } from "../../src/core/paid-pack-catalogue";
import { nflPostgameWeights } from "../../src/core/nfl-postgame-policy";
import {
  rulesets,
  nflPostgameTestRules,
  scorePlayer,
  nflFutureRarityRules,
} from "../../src/core/scoring-v1";
import { sevenRules } from "../../src/core/nfl-seven";
import { currentRulesets } from "../../src/core/scoring-release";
import {
  nflversePlayerStatistics,
  parseStatisticsCsv,
} from "../../src/core/postgame-nflverse";
import { createFreeBetaPeriod } from "../../src/core/free-beta-scoring";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
} from "../../src/core/scoring-engine";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";

test("access failures stay distinct; explicit staff destinations still require route authorization", () => {
  assert.equal(
    memberAccessFailure(Error("Authentication required")),
    "authentication",
  );
  assert.equal(memberAccessFailure(Error("Privileged MFA required")), "mfa");
  assert.equal(memberAccessFailure(Error("Role denied")), "permission");
  for (const message of [
    "fetch failed",
    "Authentication service temporarily unavailable",
    "timeout",
    "permission denied for table x",
  ])
    assert.equal(memberAccessFailure(Error(message)), "service");
  const next = "/fantasy/play?mode=OPEN&competition=abc";
  assert.equal(memberReturnPath(next), next);
  assert.equal(mfaDestination(next), next);
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/app/login",
    "/mfa",
    "/fantasy/../admin",
    "/%2f%2fevil.test",
    "/fantasy/play\n",
  ])
    assert.equal(memberReturnPath(path), null);
  assert.equal(memberReturnPath("/admin/operations"),"/admin/operations");
  assert.equal(memberReturnPath("/admin/unrecognised"),null);
});
test("market labels and legacy kicker URLs preserve enums and supported positions", () => {
  assert.deepEqual(rarities.map(rarityLabel), [
    "Core",
    "Rare",
    "Elite",
    "Ultra Rare",
    "Legendary",
    "Icon",
  ]);
  for (const position of ["K", "Kicker", "k"])
    assert.equal(marketQuery.parse({ sport: "nfl", position }).position, "");
  const state = marketplaceFixture();
  const view = marketplaceView(
    state,
    marketActors[0].id,
    marketLabels,
    marketQuery.parse({ sport: "nfl", position: "K" }),
  );
  assert.deepEqual(view.positions, ["QB", "RB", "WR", "TE"]);
});
test("podium and table share structured quantity and product labels; historical text is retained", () => {
  for (const mode of ["SALARY_CAP", "OPEN"] as const)
    for (const [i, amount] of [5, 3, 1].entries())
      assert.equal(
        prizeRewardLabel({
          from: i + 1,
          to: i + 1,
          type: "pack",
          amount,
          productVersion: prizePackProduct(mode),
          description: "obsolete duplicate",
        }),
        `${amount} × ${mode === "OPEN" ? "Premium" : "Standard"} 9 Pack NFL`,
      );
  assert.equal(
    prizeRewardLabel({
      from: 1,
      to: 1,
      type: "other",
      amount: 1,
      description: "Historical reward",
    }),
    "Historical reward",
  );
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21].map(finishingPosition), [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
  ]);
});
test("future base calculation matches game logs across imported passing/rushing/receiving/misc; legacy remains half PPR", () => {
  const rows = parseStatisticsCsv(
    readFileSync("tests/fixtures/postgame/nflverse-2026-atl-pit.csv", "utf8"),
  );
  for (const rules of [
    currentRulesets.nfl,
    nflFutureRarityRules(),
    sevenRules(),
  ]) {
    assert.deepEqual(rules.weights, nflPostgameWeights);
    for (const row of rows) {
      if (!rules.positions.includes(row.position)) continue;
      const parsed = nflversePlayerStatistics(row, undefined, rules.version);
      assert.equal(parsed.issue, null);
      assert.deepEqual(
        scorePlayer(rules, row.position, parsed.stats),
        scorePlayer(nflPostgameTestRules(), row.position, parsed.stats),
      );
    }
  }
  const raw = Object.fromEntries(
    Object.keys(nflPostgameWeights).map((k) => [k, 0]),
  );
  raw.receptions = 5;
  raw.receiving_yards = 76;
  assert.equal(scorePlayer(sevenRules(), "WR", raw).centipoints, 1260);
  assert.equal(
    scorePlayer(rulesets.nfl, "WR", {
      ...raw,
      kickoff_return_touchdowns: 0,
      punt_return_touchdowns: 0,
      offensiveFumbleRecoveryTouchdowns: 0,
    }).centipoints,
    1010,
  );
  const missing = { ...rows[0], receptions: "" };
  assert.equal(
    nflversePlayerStatistics(missing, undefined, sevenRules().version).stats,
    null,
  );
});
test("new registration rejects legacy rules; imported base -> locked rarity -> total remains exact and replay safe", () => {
  const f = syntheticScenario("nfl");
  const evidence = {
    source: "https://example.invalid/isolated",
    verifiedAt: t.save,
    completeRound: true,
    lockPolicy: "whole-round-before-first-kickoff" as const,
    offsetSeconds: 0,
  };
  const legacy = { ...f.state.period, id: "beta-real:nfl:2027:1" };
  assert.throws(
    () => createFreeBetaPeriod(legacy, t.save, evidence),
    /configuration/,
  );
  assert.equal(
    createFreeBetaPeriod(
      { ...legacy, rules: currentRulesets.nfl },
      t.save,
      evidence,
    ).period.rules.weights.receptions,
    100,
  );
  const catalogue = f.catalog.map((c) => ({
    ...c,
    rarity: "LEGENDARY" as const,
  }));
  let state = createPeriod(
    { ...f.state.period, rules: nflFutureRarityRules() },
    t.created,
  );
  for (const member of ["amber", "violet"])
    state = saveTeam(
      state,
      member,
      member,
      catalogue.filter((c) => c.owner === member).map((c) => c.cardId),
      catalogue,
      t.save,
    );
  state = lockTeams(state, catalogue, t.lock);
  const source = structuredClone(f.source);
  source.players = source.players.map((p) => ({
    ...p,
    stats: p.stats
      ? Object.fromEntries(
          Object.keys(nflPostgameWeights).map((k) => [
            k,
            (p.stats as Record<string, number>)[k],
          ]),
        )
      : null,
  }));
  state = importStatistics(
    state,
    source,
    { id: "isolated", role: "importer" },
    t.initial,
  );
  const report = results(state);
  for (const row of report.rows) {
    assert.equal(
      row.centipoints,
      row.players.reduce((n, p) => n + (p.centipoints ?? 0), 0),
    );
    for (const p of row.players)
      if (p.baseCentipoints != null)
        assert.equal(
          p.centipoints,
          Math.sign(p.baseCentipoints) *
            Math.floor((Math.abs(p.baseCentipoints) * 14 + 5) / 10),
        );
  }
  assert.deepEqual(
    importStatistics(
      state,
      source,
      { id: "isolated", role: "importer" },
      t.initial,
    ),
    state,
  );
  assert.equal(f.state.period.rules.weights.receptions, 50);
});
