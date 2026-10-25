import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import postgres from "postgres";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { createFreeBetaPeriod } from "../src/core/free-beta-scoring";
import { syntheticScenario } from "../src/core/scoring-synthetic";
import { nflFutureRarityRules } from "../src/core/scoring-v1";
import {
  saveTeam,
  lockTeams,
  importStatistics,
  results,
  digest,
  scoringCompletion,
} from "../src/core/scoring-engine";
import type { AuthorisedScoringSnapshot } from "../src/core/authorised-scoring-feed";

async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback only");
  const sql = postgres(url, { max: 20, onnotice: () => {} });
  try {
    await sql.unsafe(await readFile("sandbox/sports-feed.sql", "utf8"));
    const store = new SportsFeedStore(sql),
      f = syntheticScenario("nfl"),
      rules = nflFutureRarityRules();
    const at = new Date().toISOString(),
      before = new Date(Date.now() - 5 * 3600000).toISOString(),
      lock = new Date(Date.now() - 4 * 3600000).toISOString(),
      ended = new Date(Date.now() - 3600000).toISOString(),
      future = new Date(Date.now() + 3600000).toISOString();
    const catalog = f.catalog.map((c, i) => ({
      ...c,
      rarity: i % 7 === 0 ? ("LEGENDARY" as const) : ("CORE" as const),
    }));
    const period = {
      ...f.state.period,
      id: "beta-real:nfl:rarity-test:progressive-local",
      rules,
      inventoryScope: "invited-nfl-test-v2" as const,
      locksAt: lock,
      fixtures: Array.from({ length: 7 }, (_, i) => ({
        id: `beta-real:nfl:qa-game${i}`,
        scheduledAt: lock,
        playerIds: catalog.filter((_, j) => j % 7 === i).map((c) => c.playerId),
      })),
    };
    await store.create(
      createFreeBetaPeriod(period, before, {
        source: "https://example.invalid/isolated",
        verifiedAt: before,
        completeRound: true,
        lockPolicy: "whole-round-before-first-kickoff",
        offsetSeconds: 0,
      }),
    );
    for (const owner of ["amber", "violet"])
      await store.change(period.id, (s) =>
        saveTeam(
          s,
          owner,
          owner,
          catalog.filter((c) => c.owner === owner).map((c) => c.cardId),
          catalog,
          before,
        ),
      );
    const locked = await store.change(period.id, (s) =>
      lockTeams(s, catalog, lock),
    );
    const lockedHash = digest(locked.entries);
    const [raw] =
      await sql`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)values('nflverse','isolated','isolated','{"synthetic":true}',${at},'https://example.invalid/isolated',${future})returning id`;
    const approval = {
      provider: "nflverse",
      competition: "NFL",
      storage: true,
      evidence: "https://example.invalid/isolated",
      reviewExpires: future,
      maxAgeSeconds: 86400,
      intendedUse: "isolated-free-beta",
      fantasyUse: true,
    };
    const op = { id: "isolated-collector", role: "importer" as const };
    const source = (
      i: number,
      revision: number,
      yards: number,
      status: AuthorisedScoringSnapshot["status"] = "completed",
      dnp = false,
    ): AuthorisedScoringSnapshot => ({
      provider: "nflverse",
      competition: "NFL",
      simulated: false,
      sport: "nfl",
      fixtureId: period.fixtures[i].id,
      revision,
      observedAt: at,
      endedAt: status === "completed" ? ended : null,
      status,
      players: period.fixtures[i].playerIds.map((playerId) => ({
        playerId,
        availability: dnp ? "confirmed-dnp" : "complete",
        stats: dnp
          ? null
          : {
              ...Object.fromEntries(
                Object.keys(rules.weights).map((k) => [k, 0]),
              ),
              receiving_yards: yards,
            },
      })),
    });
    const publish = (s: AuthorisedScoringSnapshot) =>
      store.change(
        period.id,
        (state) => importStatistics(state, s, op, at, undefined, approval),
        Number(raw.id),
      );
    const journalCount = async () =>
      Number((await sql`select count(*) n from sports_feed.journal`)[0].n);
    const initial = await journalCount();
    await Promise.all(
      Array.from({ length: 20 }, () => publish(source(0, 1, 209))),
    );
    assert.equal(await journalCount(), initial + 1);
    let state = (
      await sql`select body from sports_feed.journal order by revision desc limit 1`
    )[0].body;
    assert.equal(results(state).rows[0].knownCentipoints, 2926);
    assert.equal(results(state).rows[0].rank, 1);
    await publish(source(1, 1, 100));
    await publish(source(2, 1, 0, "completed", true));
    await publish(source(3, 1, 100, "live"));
    const partial = await publish(source(3, 2, 95, "live"));
    assert.equal(results(partial).rows[0].knownCentipoints, 4876);
    assert.equal(
      scoringCompletion(results(partial).rows[0]).completedPlayers,
      3,
    );
    const count = await journalCount();
    await Promise.all(
      Array.from({ length: 20 }, () => publish(source(3, 2, 95, "live"))),
    );
    assert.equal(await journalCount(), count);
    await publish(source(3, 3, 95));
    await Promise.all([4, 5, 6].map((i) => publish(source(i, 1, 10))));
    state = (
      await sql`select body from sports_feed.journal order by revision desc limit 1`
    )[0].body;
    assert.deepEqual(
      results(state).rows.map((r) => [
        r.centipoints,
        r.rank,
        scoringCompletion(r).completedPlayers,
      ]),
      [
        [5176, 1, 7],
        [5176, 1, 7],
      ],
    );
    assert.equal(digest(state.entries), lockedHash);
    const beforeFailure = await journalCount();
    await assert.rejects(() => publish({ ...source(3, 3, 95), players: [] }));
    assert.equal(await journalCount(), beforeFailure);
    await assert.rejects(
      () => sql`update sports_feed.journal set state_hash='corrupt'`,
      /Append only/,
    );
    const report = {
      passed: true,
      scope: "Disposable native PostgreSQL; synthetic data only",
      parallelRetries: 20,
      downwardCorrection: true,
      atomicRollback: true,
      multiUserTies: true,
      completedPlayers: 7,
      finalAvailableCentipoints: 5176,
      lockedEntriesUnchanged: true,
      productionWrites: 0,
    };
    await mkdir("docs/qa/progressive-scoring", { recursive: true });
    await writeFile(
      "docs/qa/progressive-scoring/concurrency.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Concurrency failed");
  process.exitCode = 1;
});
