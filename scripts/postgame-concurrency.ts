import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { readFile, writeFile } from "node:fs/promises";
import {
  downloadPostgame,
  reconcilePostgame,
  postgameResource,
} from "../src/server/postgame-download";
import { SportsFeedStore } from "../src/server/sports-feed-store";
import { createFreeBetaPeriod } from "../src/core/free-beta-scoring";
import { syntheticScenario } from "../src/core/scoring-synthetic";
import { lockTeams, results, saveTeam } from "../src/core/scoring-engine";
import {
  nflverseRequiredColumns,
  parseStatisticsCsv,
  type PostgameMapping,
} from "../src/core/postgame-nflverse";

export async function verifyPostgame(sql: Sql) {
  await sql.unsafe(await readFile("sandbox/postgame-download.sql", "utf8"));
  const now = Date.now(),
    before = new Date(now - 12 * 3600000).toISOString(),
    lock = new Date(now - 11 * 3600000).toISOString();
  const completion = {
    observedCompletedAt: new Date(now - 7 * 3600000).toISOString(),
    evidence: "https://example.invalid/qa-completed",
  };
  const permit = {
    provider: "nflverse" as const,
    enabled: true as const,
    scope: "isolated-free-beta" as const,
    automatedDownload: true as const,
    fantasyUse: true as const,
    storage: true as const,
    derivedUse: true as const,
    evidence: "https://example.invalid/qa-source-permission",
    expiresAt: new Date(now + 86400000).toISOString(),
    rawRetentionDays: 30,
  };
  const f = syntheticScenario("nfl"),
    store = new SportsFeedStore(sql);
  const period = {
    ...f.state.period,
    id: "beta-real:nfl:postgame-qa",
    locksAt: lock,
    fixtures: [
      {
        ...f.state.period.fixtures[0],
        id: "beta-real:nfl:postgame-qa-game",
        scheduledAt: lock,
      },
    ],
  };
  const state = createFreeBetaPeriod(period, before, {
    source: "https://example.invalid/synthetic-round",
    verifiedAt: before,
    completeRound: true,
    lockPolicy: "whole-round-before-first-kickoff",
    offsetSeconds: 0,
  });
  await store.create(state);
  await store.change(period.id, (s) =>
    saveTeam(
      s,
      "amber",
      "Synthetic QA",
      f.catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
      f.catalog,
      before,
    ),
  );
  await store.change(period.id, (s) => lockTeams(s, f.catalog, lock));
  const mapping: PostgameMapping = {
    fixtureId: period.fixtures[0].id,
    gameId: "2026_01_ATL_PIT",
    season: 2026,
    seasonType: "REG",
    home: "PIT",
    away: "ATL",
    endedAt: completion.observedCompletedAt,
    completionEvidence: completion.evidence,
    players: period.fixtures[0].playerIds.map((playerId, i) => ({
      playerId,
      gsisId: `99-${String(i).padStart(7, "0")}`,
      team: "PIT",
      position: f.catalog.find((c) => c.playerId === playerId)!.position as
        "QB" | "RB" | "WR" | "TE",
    })),
  };
  const sample = parseStatisticsCsv(
    await readFile("tests/fixtures/postgame/nflverse-2026-atl-pit.csv", "utf8"),
  )[0];
  const makeCsv = (yards: string) =>
    [
      nflverseRequiredColumns.join(","),
      ...mapping.players.map((p) => {
        const row: Record<string, string> = {
          ...sample,
          player_id: p.gsisId,
          player_display_name: "Synthetic PostgreSQL QA",
          position: p.position,
          team: p.team,
          opponent_team: "ATL",
          passing_yards: yards,
        };
        return nflverseRequiredColumns.map((k) => row[k]).join(",");
      }),
    ].join("\n");
  let requests = 0;
  const mock = async () => {
    requests++;
    return new Response(makeCsv("221"), {
      headers: { "content-type": "text/csv", etag: '"qa1"' },
    });
  };
  await assert.rejects(() =>
    downloadPostgame(
      sql,
      { ...permit, enabled: false },
      2026,
      completion,
      mock,
    ),
  );
  assert.equal(requests, 0);
  await assert.rejects(
    () =>
      downloadPostgame(
        sql,
        permit,
        2026,
        { ...completion, observedCompletedAt: new Date().toISOString() },
        mock,
      ),
    /not due/,
  );
  const downloads = await Promise.all(
    Array.from({ length: 20 }, () =>
      downloadPostgame(sql, permit, 2026, completion, mock),
    ),
  );
  assert.equal(requests, 1);
  const rawId = downloads.find((d) => d.status === "downloaded")!.rawId!;
  assert.equal(downloads.filter((d) => d.status === "cooldown").length, 19);
  const op = { id: "qa-postgame-importer", role: "importer" as const };
  const reconciled = await Promise.all(
    Array.from({ length: 20 }, () =>
      reconcilePostgame(sql, period.id, rawId, mapping, permit, op),
    ),
  );
  const original = reconciled[0].state;
  assert.equal(original.sources.length, 1);
  assert.equal(reconciled[0].status, "provisional");
  assert.equal(results(original).rows[0].centipoints !== null, true);
  await assert.rejects(
    () =>
      reconcilePostgame(
        sql,
        period.id,
        rawId,
        {
          ...mapping,
          players: mapping.players.map((p, i) =>
            i === 0 ? { ...p, gsisId: "99-9999999" } : p,
          ),
        },
        permit,
        op,
      ),
    /frozen/,
  );
  const resource = postgameResource(2026);
  const due = () =>
    sql`update sports_feed.postgame_cache set next_attempt=clock_timestamp()-interval '1 second' where resource=${resource}`;
  await due();
  const cached = await downloadPostgame(
    sql,
    permit,
    2026,
    completion,
    async (_u, init) => {
      assert.equal(
        (init?.headers as Record<string, string>)["If-None-Match"],
        '"qa1"',
      );
      return new Response(null, { status: 304 });
    },
  );
  assert.equal(cached.rawId, rawId);
  assert.equal(
    (await reconcilePostgame(sql, period.id, rawId, mapping, permit, op)).state
      .sources.length,
    1,
  );
  await due();
  const changed = await downloadPostgame(
    sql,
    permit,
    2026,
    completion,
    async () =>
      new Response(makeCsv("222"), { headers: { "content-type": "text/csv" } }),
  );
  const corrected = await reconcilePostgame(
    sql,
    period.id,
    changed.rawId!,
    mapping,
    permit,
    op,
  );
  assert.equal(corrected.state.sources.length, 2);
  assert.deepEqual(corrected.state.sources[0], original.sources[0]);
  assert.deepEqual(corrected.state.entries, original.entries);
  assert.equal(corrected.state.audits.at(-1)?.action, "statistics-corrected");
  await due();
  await assert.rejects(
    () =>
      downloadPostgame(
        sql,
        permit,
        2026,
        completion,
        async () =>
          new Response("bad", { headers: { "content-type": "text/csv" } }),
      ),
    /pending/,
  );
  assert.equal(
    (await downloadPostgame(sql, permit, 2026, completion, mock)).status,
    "cooldown",
  );
  const [health] =
    await sql`select error_code from sports_feed.postgame_cache where resource=${resource}`;
  assert.equal(health.error_code, "SOURCE_UNAVAILABLE_OR_SCHEMA_CHANGED");
  for (const table of ["postgame_cache", "postgame_mapping"]) {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`set local role feed_ordinary`;
          await tx.unsafe(`select * from sports_feed.${table}`);
        }),
      /permission/,
    );
  }
  await assert.rejects(
    () => sql`update sports_feed.postgame_mapping set actor='changed'`,
    /Append/,
  );
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Disposable PostgreSQL, synthetic contract data and mocked network; not hosted/provider acceptance",
    passed: true,
    checks: [
      "20-way download cooldown: one request",
      "rights and post-game timing gate before network",
      "20-way reconciliation: one append",
      "304 cached evidence no duplicate",
      "correction appends and preserves locked team/source",
      "frozen provider mapping",
      "schema failure visible, no zero fallback",
      "failed requests retain cooldown",
      "ordinary role denied private cache/mapping",
      "immutable mapping audit",
    ],
  };
  await writeFile(
    "docs/qa/free-beta-data/postgame-postgres.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
