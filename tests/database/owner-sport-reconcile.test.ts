import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { pgliteSql } from "../fixtures/pglite-sql";
import { reconcileOwnerSportFeed } from "../../src/server/owner-sport-reconcile";
import { SportReadinessStore } from "../../src/server/sport-readiness-store";
import { sportEventRules } from "../../src/core/sport-event-rules";
import {
  digest,
  results,
  scoringCompletion,
  type ScoringState,
} from "../../src/core/scoring-engine";
test("canonical service handoff: NBA multiple games, DNP, missing stats, corrections, replay and atomic rollback", async () => {
  const url = process.env.FANTASY_TEST_DATABASE_URL;
  if (
    url &&
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback only");
  const pg = url ? null : new PGlite();
  const sql = url ? postgres(url, { max: 8 }) : pgliteSql(pg!);
  const exec = (q: string) => (pg ? pg.exec(q) : sql.unsafe(q));
  try {
    await exec(
      "create role anon;create role authenticated;create role docked_app;create role docked_beta_app;create schema beta_private;",
    );
    await exec(await readFile("sandbox/sports-feed.sql", "utf8"));
    await exec(
      await readFile(
        "supabase/migrations/20261022010531_multi_sport_readiness_registry.sql",
        "utf8",
      ),
    );
    const now = "2099-01-04T00:00:00Z",
      rules = sportEventRules("basketball");
    const players = rules.slots.map((s, i) => ({
      playerId: `qa:p${i}`,
      providerPlayerId: `source${i}`,
      position: s.positions[0],
    }));
    const policy = {
      sport: "basketball",
      season: "2099",
      provider: "qa-owner-feed",
      rightsEvidence: "https://example.invalid/qa-policy",
      rightsExpiresAt: "2099-02-01T00:00:00Z",
      rosterUse: true,
      storage: true,
      fantasyUse: true,
      maxAgeHours: 24,
      permittedRegistrations: ["active"],
    };
    const roster = players.map((p) => ({
      ...p,
      position: undefined,
      sport: "basketball",
      season: "2099",
      provider: policy.provider,
      name: "Fictional QA",
      teamId: "qa:team",
      teamName: "QA Team",
      identityVerified: true,
      registration: "active",
      availability: "available",
      positions: [p.position],
      positionsVerified: true,
      jerseyNumber: null,
      jerseyVerified: false,
      evidence: {
        url: "https://example.invalid/qa-roster",
        sha256: "a".repeat(64),
        observedAt: now,
      },
    }));
    const cleanRoster = roster.map(({ position: _, ...p }) => {
      void _;
      return p;
    });
    await new SportReadinessStore(sql).stageRoster(
      cleanRoster,
      policy,
      ["qa:team"],
      now,
    );
    const state: ScoringState = {
      schemaVersion: 1,
      scope: "authorised-free-beta",
      period: {
        id: "beta-real:basketball:qa",
        sport: "basketball",
        label: "Fictional contract acceptance",
        locksAt: "2099-01-01T00:00:00Z",
        window: {
          start: "2099-01-01T00:00:00Z",
          end: "2099-01-08T00:00:00Z",
          timezone: "UTC",
        },
        rules,
        fixtures: [1, 2].map((n) => ({
          id: `fixture${n}`,
          scheduledAt: `2099-01-0${n}T12:00:00Z`,
          playerIds: players.map((p) => p.playerId),
        })),
      },
      entries: [
        {
          member: "qa",
          name: "QA",
          rulesHash: digest(rules),
          lockedAt: "2099-01-01T00:00:00Z",
          cards: players.map((p, i) => ({
            cardId: `qa:c${i}`,
            playerId: p.playerId,
            position: p.position,
            slot: rules.slots[i].id,
          })),
        },
      ],
      sources: [],
      audits: [
        {
          sequence: 1,
          actor: "qa",
          action: "isolated-test-fixture",
          at: now,
          reason: "Fictional test only",
          payloadHash: digest(players),
        },
      ],
      lineupsLockedAt: "2099-01-01T00:00:00Z",
      finalisedAt: null,
    };
    await sql`insert into sports_feed.streams(id) values(${state.period.id})`;
    await sql`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values(${state.period.id},1,'',${digest(state)},${sql.json(JSON.parse(JSON.stringify(state)))},${sql.json(JSON.parse(JSON.stringify(results(state))))})`;
    const mapping = {
      sport: "basketball",
      season: "2099",
      provider: policy.provider,
      providerFixtureId: "game1",
      fixtureId: "fixture1",
      scoringVersion: rules.version,
      maxAgeSeconds: 3600,
      players,
    };
    const stats = {
      points: 10,
      rebounds: 2,
      assists: 3,
      steals: 1,
      blocks: 0,
      turnovers: 2,
      threePointers: 1,
    };
    const feed = {
      schemaVersion: 1,
      sport: "basketball",
      season: "2099",
      provider: policy.provider,
      providerFixtureId: "game1",
      revision: 1,
      observedAt: now,
      endedAt: "2099-01-03T22:00:00Z",
      status: "completed",
      evidence: {
        url: "https://example.invalid/qa-game",
        sha256: "a".repeat(64),
      },
      players: players.map((p) => ({
        providerPlayerId: p.providerPlayerId,
        availability: "complete",
        stats,
      })),
    };
    const permit = {
      provider: policy.provider,
      competition: "NBA",
      intendedUse: "isolated-free-beta",
      fantasyUse: true,
      storage: true,
      evidence: policy.rightsEvidence,
      reviewExpires: policy.rightsExpiresAt,
      maxAgeSeconds: 3600,
      rawRetentionDays: 1,
      liveUse: false,
    };
    const op = { id: "qa-importer", role: "importer" as const };
    const run = (f = feed, m = mapping, p = permit) =>
      reconcileOwnerSportFeed(sql, state.period.id, f, m, p, op, now);
    const first = await run();
    assert.equal(
      results(first.state).rows[0].knownCentipoints,
      21 * 100 * players.length,
    );
    assert.equal(results(first.state).rows[0].centipoints, null);
    assert.equal(
      scoringCompletion(results(first.state).rows[0]).completedPlayers,
      0,
    );
    assert.equal((await run()).replay, true);
    const retries = url
      ? await Promise.all(Array.from({ length: 8 }, () => run()))
      : [await run()];
    assert(retries.every((r) => r.replay));
    const map2 = {
      ...mapping,
      fixtureId: "fixture2",
      providerFixtureId: "game2",
    };
    const secondFeed = {
      ...feed,
      providerFixtureId: "game2",
      players: feed.players.slice(1),
    };
    const partial = await run(secondFeed, map2);
    assert.equal(
      scoringCompletion(results(partial.state).rows[0]).completedPlayers,
      players.length - 1,
    );
    assert.equal(results(partial.state).rows[0].centipoints, null);
    const dnp = {
      ...secondFeed,
      revision: 2,
      players: [
        {
          providerPlayerId: players[0].providerPlayerId,
          availability: "confirmed-dnp",
          stats: null,
        },
        ...secondFeed.players,
      ],
    };
    const resolved = await reconcileOwnerSportFeed(
      sql,
      state.period.id,
      dnp,
      map2,
      permit,
      op,
      now,
    );
    assert.equal(
      results(resolved.state).rows[0].centipoints,
      (players.length * 2 - 1) * 2100,
    );
    assert.equal(
      scoringCompletion(results(resolved.state).rows[0]).completedPlayers,
      players.length,
    );
    const correction = {
      ...feed,
      revision: 2,
      players: feed.players.map((p) => ({
        ...p,
        stats: { ...stats, points: 11 },
      })),
    };
    const corrected = await run(correction);
    assert.equal(
      results(corrected.state).rows[0].centipoints,
      (players.length * 2 - 1) * 2100 + players.length * 100,
    );
    assert.equal(corrected.state.audits.at(-1)?.action, "statistics-corrected");
    await assert.rejects(run({ ...correction, revision: 1 }), /revision/);
    await assert.rejects(
      run({ ...feed, status: "live", endedAt: null } as unknown as typeof feed),
      /postgame-only/,
    );
    await assert.rejects(
      run(correction, { ...mapping, season: "2100" }),
      /season/,
    );
    await assert.rejects(
      run(correction, mapping, { ...permit, reviewExpires: now }),
      /permission/,
    );
    const count = (
      await sql`select count(*)::int n from sports_feed.raw_revisions`
    )[0].n;
    const final = { ...corrected.state, finalisedAt: now };
    await sql`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) select ${state.period.id},max(revision)+1,${digest(corrected.state)},${digest(final)},${sql.json(JSON.parse(JSON.stringify(final)))},${sql.json(JSON.parse(JSON.stringify(results(final))))} from sports_feed.journal where stream_id=${state.period.id}`;
    await assert.rejects(
      run({ ...correction, revision: 3 }),
      /late correction/,
    );
    assert.equal(
      (await sql`select count(*)::int n from sports_feed.raw_revisions`)[0].n,
      count,
      "failed import rolls back raw receipt and journal together",
    );
  } finally {
    if (pg) await pg.close();
    else await sql.end();
  }
});
