import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolRosterCandidate } from "../../src/core/commercial-pool-plan";
import {
  parsePoolOutputTag,
  readDatedPoolInputs,
  selectStablePoolIdentities,
  sourceSha256,
} from "../../scripts/roster-refresh-20261106/pool-source-inputs";

const now = Date.parse("2026-11-06T00:00:00.000Z");
test("dated source revisions have distinct immutable output tags", () => {
  assert.equal(
    parsePoolOutputTag("20261106").version,
    "dormant-real-player-pool-2026-11-06-v1",
  );
  assert.equal(
    parsePoolOutputTag("20261106-v2").version,
    "dormant-real-player-pool-2026-11-06-v2",
  );
  assert.throws(() => parsePoolOutputTag("20261106-v1"));
  assert.throws(() => parsePoolOutputTag("../20261106"));
  assert.throws(() => parsePoolOutputTag("20261131"));
});
const row = (n = 1): PoolRosterCandidate => ({
  id: `f1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  sport: "nfl",
  provider: "nflverse",
  providerId: `fixture-${n}`,
  eligiblePositions: ["WR"],
  snapshot: {
    name: `Fixture ${n}`,
    team: "ARI",
    position: "WR",
    season: "2026",
    verifiedJerseyNumber: null,
    colour: "#000001",
    status: "active",
    synthetic: false,
  },
  source: {
    url: "https://www.azcardinals.com/team/players-roster/",
    hash: "a".repeat(64),
    checkedAt: new Date(now - 3600000).toISOString(),
    license: "factual-source-fixture",
    verification: "source-fixture",
    permanentIssuanceEligible: false,
  },
});
function input(rows: PoolRosterCandidate[], overrides = {}) {
  const bytes = Buffer.from(JSON.stringify(rows));
  const manifest = Buffer.from(
    JSON.stringify({
      inputsSha256: sourceSha256(bytes),
      accepted: rows.length,
      productionWrites: 0,
      teams: rows.map((p) => ({
        team: p.snapshot.team,
        sourceHash: p.source.hash,
        fetchedAt: p.source.checkedAt,
      })),
      ...overrides,
    }),
  );
  return [bytes, manifest] as const;
}

test("dated pool inputs require matching bytes, count and original team evidence", () => {
  const p = row();
  const [bytes, manifest] = input([p]);
  assert.deepEqual(readDatedPoolInputs("nfl", bytes, manifest, now).players, [
    p,
  ]);
  assert.throws(
    () =>
      readDatedPoolInputs(
        "nfl",
        Buffer.concat([bytes, Buffer.from(" ")]),
        manifest,
        now,
      ),
    /hash differs/,
  );
  assert.throws(
    () => readDatedPoolInputs("nfl", ...input([p], { accepted: 0 }), now),
    /count differs/,
  );
  assert.throws(
    () => readDatedPoolInputs("nfl", ...input([p], { teams: [] }), now),
    /recorded official observation/,
  );
  assert.throws(
    () =>
      readDatedPoolInputs("nfl", ...input([p], { productionWrites: 1 }), now),
    /local source evidence/,
  );
});

test("stale, future and incompatible season evidence cannot qualify", () => {
  for (const hours of [72, -1]) {
    const p = row();
    p.source.checkedAt = new Date(now - hours * 3600000).toISOString();
    assert.throws(
      () => readDatedPoolInputs("nfl", ...input([p]), now),
      /stale or future/,
    );
  }
  const p = row();
  p.snapshot.season = "2027";
  assert.throws(
    () => readDatedPoolInputs("nfl", ...input([p]), now),
    /Wrong candidate season/,
  );
});

test("NFL sources retain the four approved positions and exact official team URL", () => {
  const p = row();
  p.eligiblePositions.push("K");
  assert.throws(() => readDatedPoolInputs("nfl", ...input([p]), now));
  p.eligiblePositions.pop();
  p.source.url = "https://www.miamidolphins.com/team/players-roster/";
  assert.throws(() => readDatedPoolInputs("nfl", ...input([p]), now));
});

test("Australian evidence has attribution, no NRL number guessing and no old-row fallback", () => {
  const p = row();
  p.sport = "nrl";
  p.provider = "wikimedia";
  p.source.url =
    "https://en.wikipedia.org/wiki/List_of_current_NRL_team_squads";
  p.source.license = "CC-BY-SA-4.0";
  p.snapshot.team = "Brisbane Broncos";
  p.snapshot.position = "CTR";
  p.eligiblePositions = ["CTR"];
  assert.equal(readDatedPoolInputs("wikimedia", ...input([p]), now).count, 1);
  p.snapshot.verifiedJerseyNumber = 23;
  assert.throws(() => readDatedPoolInputs("wikimedia", ...input([p]), now));
  assert.deepEqual(
    readDatedPoolInputs("wikimedia", ...input([]), now).players,
    [],
  );
});

test("stable-ID merge holds disagreements, provider aliases and unknown IDs", () => {
  const baseline = row(1);
  const ambiguous = {
    ...baseline,
    snapshot: { ...baseline.snapshot, team: "MIA" },
  };
  const a = row(2);
  const alias = { ...row(3), providerId: a.providerId };
  const unchanged = row(4);
  const unknown = row(5);
  const chosen = selectStablePoolIdentities(
    [baseline, unchanged],
    [ambiguous, a, alias, unchanged, unknown],
    [baseline, a, alias, unchanged],
  );
  assert.deepEqual(chosen.players, [unchanged]);
  assert.equal(chosen.duplicateCopies, 1);
  assert.deepEqual(
    chosen.holds.map((p) => p.reason),
    [
      "stable-id-conflict",
      "provider-identity-conflict",
      "provider-identity-conflict",
      "no-matching-existing-provider-identity",
    ],
  );
});
