import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  poolRosterCandidate,
  type PoolRosterCandidate,
} from "../../src/core/commercial-pool-plan";
import { officialUrl } from "../../src/core/official-roster-refresh";

export const nflPoolPositions = ["QB", "RB", "WR", "TE"];
const missingNflTeams = new Set(["ARI", "MIA", "TEN"]);
const maximumObservationAgeMs = 72 * 60 * 60 * 1000;
export const sourceSha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export function parsePoolOutputTag(tag: string) {
  const matched = /^(20\d{6})(?:-v([2-9]|[1-9]\d{1,5}))?$/.exec(tag);
  assert(matched, "Use YYYYMMDD or YYYYMMDD-v2 or later for a new output");
  const [, dateTag, revision = "1"] = matched;
  const date = `${dateTag.slice(0, 4)}-${dateTag.slice(4, 6)}-${dateTag.slice(6)}`;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  assert(
    Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(date),
    "Use a valid calendar date in the output tag",
  );
  return { dateTag, version: `dormant-real-player-pool-${date}-v${revision}` };
}

/** Match a reviewed derivative to its audit manifest, without treating either
 * local artifact as authority to approve supply or invent an identity. */
export function readDatedPoolInputs(
  group: "nfl" | "wikimedia",
  inputBytes: Buffer,
  manifestBytes: Buffer,
  now: number,
) {
  const manifest = JSON.parse(manifestBytes.toString());
  const digest = sourceSha256(inputBytes);
  assert.equal(manifest.inputsSha256, digest, "Source input hash differs");
  const payload = JSON.parse(inputBytes.toString());
  assert(Array.isArray(payload), "Expected a dated source input array");
  assert.equal(manifest.accepted, payload.length, "Source input count differs");
  assert.equal(manifest.productionWrites, 0, "Expected local source evidence");
  const players = payload.map((value) => poolRosterCandidate.parse(value));
  for (const p of players) {
    const age = now - Date.parse(p.source.checkedAt);
    assert(
      age >= 0 && age < maximumObservationAgeMs,
      "Source observation is stale or future-dated",
    );
    assert.equal(p.snapshot.season, "2026", "Wrong candidate season");
    assert.equal(
      p.snapshot.status,
      "active",
      "Expected a current eligible row",
    );
    assert(p.eligiblePositions.includes(p.snapshot.position));
    if (group === "nfl") {
      assert.equal(p.sport, "nfl");
      assert.equal(p.provider, "nflverse");
      assert(
        missingNflTeams.has(p.snapshot.team),
        "Unexpected NFL source team",
      );
      assert.equal(p.source.url, officialUrl(p.snapshot.team));
      assert(
        p.eligiblePositions.every((pos) => nflPoolPositions.includes(pos)),
      );
      assert(
        Array.isArray(manifest.teams) &&
          manifest.teams.some(
            (t: Record<string, unknown>) =>
              t.team === p.snapshot.team &&
              t.sourceHash === p.source.hash &&
              t.fetchedAt === p.source.checkedAt,
          ),
        "NFL input is not tied to its recorded official observation",
      );
    } else {
      assert(p.sport === "afl" || p.sport === "nrl");
      assert.equal(p.provider, "wikimedia");
      const url = new URL(p.source.url);
      assert.equal(url.origin, "https://en.wikipedia.org");
      assert.equal(p.source.license, "CC-BY-SA-4.0");
      if (p.sport === "nrl")
        assert.equal(p.snapshot.verifiedJerseyNumber, null);
    }
  }
  return {
    players,
    inputsSha256: digest,
    manifestSha256: sourceSha256(manifestBytes),
    count: players.length,
  };
}

type KnownIdentity = {
  id: string;
  sport: string;
  provider: string;
  providerId: string;
};
type Held = { id: string; sport: string; reason: string };
const providerKey = (p: KnownIdentity) =>
  `${p.sport}:${p.provider}:${p.providerId}`;
const identityKey = (p: KnownIdentity) => `${p.id}:${providerKey(p)}`;

/** Stable IDs are authoritative. A conflicting match is held rather than
 * choosing a provider record by row order, date, name or inferred transfer. */
export function selectStablePoolIdentities(
  baseline: PoolRosterCandidate[],
  additions: PoolRosterCandidate[],
  known: KnownIdentity[],
) {
  const knownKeys = new Set(known.map(identityKey));
  const holds: Held[] = [];
  const hold = (p: PoolRosterCandidate, reason: string) =>
    holds.push({ id: p.id, sport: p.sport, reason });
  const groups = new Map<string, PoolRosterCandidate[]>();
  for (const p of [...baseline, ...additions]) {
    const group = groups.get(p.id) ?? [];
    group.push(p);
    groups.set(p.id, group);
  }
  const candidates: PoolRosterCandidate[] = [];
  let duplicateCopies = 0;
  for (const group of groups.values()) {
    const [p] = group;
    if (new Set(group.map((row) => JSON.stringify(row))).size !== 1) {
      hold(p, "stable-id-conflict");
      continue;
    }
    duplicateCopies += group.length - 1;
    if (!knownKeys.has(identityKey(p))) {
      hold(p, "no-matching-existing-provider-identity");
      continue;
    }
    candidates.push(p);
  }
  const providerCounts = new Map<string, number>();
  for (const p of candidates) {
    const key = providerKey(p);
    providerCounts.set(key, (providerCounts.get(key) ?? 0) + 1);
  }
  const players = candidates.filter((p) => {
    if (providerCounts.get(providerKey(p)) === 1) return true;
    hold(p, "provider-identity-conflict");
    return false;
  });
  players.sort((a, b) => a.id.localeCompare(b.id));
  holds.sort((a, b) => a.id.localeCompare(b.id));
  return { players, holds, duplicateCopies };
}
