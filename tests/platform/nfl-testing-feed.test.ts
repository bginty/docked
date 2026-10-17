import { test } from "node:test";
import assert from "node:assert/strict";
import { NflTestingClient } from "../../src/server/nfl-testing-client";
import { playerReadiness } from "../../src/core/nfl-testing-feed";
import {
  nflPostgameTestRules,
  rulesets,
  scorePlayer,
} from "../../src/core/scoring-v1";
import { reviewTestingIdentities } from "../../src/server/nfl-testing-identities";
import {
  feedRaw,
  feedGameFixture,
  eventPage,
} from "../fixtures/nfl-testing-data";
test("separate full-PPR test version preserves old scoring and demands current required fields", () => {
  const raw = feedRaw();
  raw.stats.passing_yards = 250;
  raw.stats.passing_touchdowns = 2;
  raw.stats.interceptions_thrown = 1;
  raw.stats.rushing_yards = -5;
  raw.stats.receptions = 4;
  raw.stats.receiving_yards = 30;
  raw.stats.fumbles_lost = 1;
  for (const key of [
    "passing_two_point_conversions",
    "rushing_two_point_conversions",
    "receiving_two_point_conversions",
  ])
    raw.stats[key] = 1;
  assert.equal(
    scorePlayer(nflPostgameTestRules(), "QB", raw.stats).centipoints,
    2650,
  );
  assert.equal(rulesets.nfl.weights.receptions, 50);
  assert.equal(rulesets.nfl.weights.fumbles_lost, -200);
  assert.equal(rulesets.nfl.weights.kickoff_return_touchdowns, 600);
  assert.throws(() => scorePlayer(rulesets.nfl, "QB", raw.stats));
  const game = feedGameFixture();
  game.stats_state = "incomplete";
  game.usable = false;
  assert.equal(playerReadiness(raw, game, "QB").points, 2650);
  assert.equal(playerReadiness(raw, game, "QB").competitionReady, false);
  raw.fields.fumbles_lost.current = false;
  assert.equal(playerReadiness(raw, game, "QB").points, null);
  assert.equal(playerReadiness(undefined, game, "QB").status, "Awaiting stats");
  const zero = feedRaw();
  zero.stats.receptions = 0;
  assert.equal(playerReadiness(zero, feedGameFixture(), "QB").points, 0);
  assert.equal(
    playerReadiness(zero, { ...feedGameFixture(), week: 99 }, "QB").points,
    null,
  );
  assert.equal(
    playerReadiness(
      { ...zero, stats: { ...zero.stats, fumbles_lost: null } },
      feedGameFixture(),
      "QB",
    ).points,
    null,
  );
  game.freshness.stale = true;
  assert.equal(playerReadiness(zero, game, "QB").points, null);
});
test("HTTP credentials stay on allowlisted server, redirects denied, retries bounded, 410 explicit", async () => {
  const key = "isolated-test-key-not-real-credential",
    base = "http://127.0.0.1:8080";
  assert.throws(
    () =>
      new NflTestingClient("http://public.example", key, [
        "http://public.example",
      ]),
  );
  assert.throws(() => new NflTestingClient(base, key, []));
  let calls = 0;
  const delays: number[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    assert.equal(init?.redirect, "manual");
    assert.equal((init?.headers as any).Authorization, `Bearer ${key}`);
    calls++;
    return calls < 3
      ? new Response("", {
          status: calls === 1 ? 429 : 503,
          headers: { "retry-after": "1" },
        })
      : Response.json(eventPage(1));
  };
  await new NflTestingClient(base, key, [base], fetcher, async (ms) => {
    delays.push(ms);
  }).get("/v1/stat-changes");
  assert.equal(calls, 3);
  assert.ok(delays[0] >= 1000);
  for (const status of [401, 302, 410])
    await assert.rejects(
      () =>
        new NflTestingClient(
          base,
          key,
          [base],
          async () => new Response("", { status }),
        ).get("/v1/seasons"),
      new RegExp(
        status === 410
          ? "RESYNC"
          : status === 401
            ? "AUTHENTICATION"
            : "HTTP_302",
      ),
    );
  await assert.rejects(
    () =>
      new NflTestingClient(base, key, [base], async () =>
        Response.json({ wrong: true }),
      ).get("/v1/seasons"),
    /INVALID_RESPONSE/,
  );
});
test("reviewed provider identities never merge namesakes or guess a position", () => {
  const result = reviewTestingIdentities(
    [
      { id: "wr", providerId: "verified-wr", position: "WR" },
      { id: "lb", providerId: "verified-lb", position: "WR" },
    ],
    [
      { canonical_id: "p_wr", external_id: "verified-wr", position: "WR" },
      { canonical_id: "p_lb", external_id: "verified-lb", position: "LB" },
    ],
  );
  assert.equal(result.approved[0].canonical, "p_wr");
  assert.deepEqual(result.quarantined, ["lb"]);
});
