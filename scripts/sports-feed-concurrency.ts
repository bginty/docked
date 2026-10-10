import assert from "node:assert/strict";
import postgres from "postgres";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { runSportsFetch } from "../src/server/sports-feed-worker";
import { reconcileFeed } from "../src/server/sports-feed-reconcile";
import { createFreeBetaPeriod } from "../src/core/free-beta-scoring";
import { syntheticScenario } from "../src/core/scoring-synthetic";
import {
  saveTeam,
  lockTeams,
  results,
  finalise,
} from "../src/core/scoring-engine";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback only");
  const sql = postgres(url, { max: 24 });
  try {
    await sql.unsafe(await readFile("sandbox/sports-feed.sql", "utf8"));
    const store = new SportsFeedStore(sql),
      now = new Date(),
      future = new Date(now.getTime() + 3600000).toISOString();
    const permit = {
      provider: "sportsdataio" as const,
      enabled: true as const,
      scope: "isolated-free-beta" as const,
      fantasyUse: true as const,
      rawStorage: true as const,
      derivedStorage: true as const,
      evidence: "https://example.invalid/contract-only",
      expiresAt: future,
      unscrambled: true as const,
      maxRequestsPerDay: 3,
      rawRetentionDays: 30,
    };
    const quotas = await Promise.allSettled(
      Array.from({ length: 20 }, () => store.reserveQuota(permit)),
    );
    assert.equal(quotas.filter((x) => x.status === "fulfilled").length, 3);
    const p = { ...permit, maxRequestsPerDay: 100 };
    const req = {
      provider: "sportsdataio" as const,
      kind: "boxscore" as const,
      id: 1,
    };
    await Promise.all(
      Array.from({ length: 20 }, () => store.enqueue("one", req)),
    );
    const claimed = await Promise.all(
      Array.from({ length: 20 }, () => store.claim()),
    );
    assert.equal(claimed.filter(Boolean).length, 1);
    const lease = claimed.find(Boolean)!;
    await assert.rejects(
      () =>
        store.record(
          "one",
          "00000000-0000-4000-8000-000000000000",
          {},
          p,
          new Date().toISOString(),
        ),
      /lease/,
    );
    await store.fail("one", lease.lease);
    await sql`update sports_feed.jobs set available_at=clock_timestamp() where id='one'`;
    const raw = {
      Score: {
        ScoreID: 1,
        Status: "Final",
        GameEndDateTime: "2026-10-10T15:00:00",
      },
      PlayerGames: [],
    };
    const outcome = await runSportsFetch(
      store,
      { sportsdataio: p },
      { sportsdataio: "contract-secret" },
      async () => Response.json(raw),
    );
    assert.equal(outcome.status, "recorded");
    const rawId = outcome.rawId!;
    const f = syntheticScenario("nfl");
    const before = new Date(now.getTime() - 7200000).toISOString(),
      lock = new Date(now.getTime() - 3600000).toISOString();
    const period = {
      ...f.state.period,
      id: "beta-real:nfl:contract",
      locksAt: lock,
      fixtures: [
        {
          id: "beta-real:nfl:one",
          scheduledAt: lock,
          playerIds: f.state.period.fixtures[0].playerIds,
        },
      ],
    };
    let state = createFreeBetaPeriod(period, before, {
      source: "https://example.invalid/full-round",
      verifiedAt: before,
      completeRound: true,
      lockPolicy: "whole-round-before-first-kickoff",
      offsetSeconds: 0,
    });
    await store.create(state);
    state = await store.change(period.id, (s) =>
      saveTeam(
        s,
        "amber",
        "Synthetic QA",
        f.catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
        f.catalog,
        before,
      ),
    );
    state = await store.change(period.id, (s) => lockTeams(s, f.catalog, lock));
    const mapping = {
      fixtureId: period.fixtures[0].id,
      providerFixtureId: 1,
      playerIds: period.fixtures[0].playerIds,
      providerPlayers: Object.fromEntries(
        period.fixtures[0].playerIds.map((id, i) => [id, String(i + 1)]),
      ),
    };
    const op = { id: "contract-importer", role: "importer" as const };
    const reconciled = await Promise.all(
      Array.from({ length: 20 }, () =>
        reconcileFeed(sql, period.id, rawId, mapping, p, op),
      ),
    );
    state = reconciled[0].state;
    assert.equal(state.sources.length, 1);
    assert.equal(results(state).rows[0].centipoints, null);
    assert.throws(
      () => finalise(state, { id: "qa-reviewer", role: "reviewer" }, future),
      /Pending/,
    );
    assert.equal(
      Number(
        (
          await sql`select count(*) n from sports_feed.journal where raw_id=${rawId}`
        )[0].n,
      ),
      1,
    );
    await assert.rejects(
      () => sql`update sports_feed.journal set previous_hash=''`,
      /Append/,
    );
    await assert.rejects(
      () =>
        sql`update sports_feed.raw_revisions set body='{}'::jsonb where id=${rawId}`,
      /immutable/,
    );
    const [expired] =
      await sql`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)
      values('sportsdataio','expired-contract','retained-hash','{"contractOnly":true}',clock_timestamp()-interval '2 days','https://example.invalid/licence',clock_timestamp()-interval '1 day') returning id`;
    assert.equal((await store.purgeExpired()).payloadsPurged, 1);
    assert.equal((await store.purgeExpired()).payloadsPurged, 0);
    const [purged] =
      await sql`select * from sports_feed.raw_revisions where id=${expired.id}`;
    assert.equal(purged.body, null);
    assert.equal(purged.body_hash, "retained-hash");
    assert.ok(purged.purged_at);
    assert.equal((await store.health())[0].jobs, 1);
    await sql.unsafe(
      "create role feed_ordinary;grant usage on schema sports_feed to feed_ordinary",
    );
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`set local role feed_ordinary`;
          await tx`select * from sports_feed.raw_revisions`;
        }),
      /permission/,
    );
    await store.enqueue("rights-blocked", { ...req, id: 2 });
    const disabled = await runSportsFetch(store, {}, {});
    assert.equal(disabled.status, "not-configured");
    const report = {
      checkedAt: new Date().toISOString(),
      scope:
        "Disposable PostgreSQL; contract fixtures, no live provider request",
      passed: true,
      checks: [
        "20-way quota cap",
        "20-way job claim",
        "stale lease rejected",
        "retry and raw persistence",
        "20-way reconciliation exactly once",
        "missing stats stay pending; finalisation denied",
        "immutable journal",
        "member raw-data denial",
        "unapproved source blocked before fetch",
        "licensed raw expiry removes payload only; hash/provenance remain; purge idempotent",
      ],
    };
    await mkdir("docs/qa/free-beta-data", { recursive: true });
    await writeFile(
      "docs/qa/free-beta-data/feed-postgres.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Feed acceptance failed");
  process.exitCode = 1;
});
