import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import {
  downloadNflDataset,
  nflResource,
  observeNflCompletions,
} from "../src/server/nflverse-bundle";
import { reconcileNflBundle } from "../src/server/nfl-postgame-reconcile";
import { createNflHistoricalQa } from "./nfl-postgame-qa";
import {
  nflverseRequiredColumns,
  parseStatisticsCsv,
} from "../src/core/postgame-nflverse";
import { pbpColumns } from "../src/core/nflverse-evidence";
import { digest, results, finalise } from "../src/core/scoring-engine";
import { SportsFeedStore } from "../src/server/sports-feed-store";
export async function verifyNflBundle(sql: Sql) {
  await sql.unsafe(await readFile("sandbox/nfl-postgame-bundle.sql", "utf8"));
  const permit = {
    provider: "nflverse",
    enabled: true,
    scope: "isolated-free-beta",
    automatedDownload: true,
    fantasyUse: true,
    storage: true,
    derivedUse: true,
    evidence: "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    rawRetentionDays: 30,
  };
  const weekly = await readFile(
    "tests/fixtures/postgame/nflverse-2026-atl-pit.csv",
    "utf8",
  );
  // Actual completed-game cached source; no invented live statistics.
  const pbp: Record<string, string>[] = JSON.parse(
    await readFile(
      "tests/fixtures/postgame/nflverse-2026-atl-pit-pbp.json",
      "utf8",
    ),
  );
  const csv = (cols: readonly string[], rows: Record<string, string>[]) =>
    [
      cols.join(","),
      ...rows.map((r) =>
        cols.map((k) => `"${r[k].replaceAll('"', '""')}"`).join(","),
      ),
    ].join("\n");
  let requests = 0;
  const download = (dataset: "weekly" | "pbp", body: string) =>
    downloadNflDataset(sql, permit, dataset, 2026, async () => {
      requests++;
      return new Response(dataset === "pbp" ? gzipSync(body) : body, {
        headers: { "content-type": "application/octet-stream" },
      });
    });
  const weeklyDownloads = await Promise.all(
    Array.from({ length: 20 }, () => download("weekly", weekly)),
  );
  assert.equal(requests, 1);
  assert.equal(
    weeklyDownloads.filter((d) => d.status === "cooldown").length,
    19,
  );
  const weeklyId = weeklyDownloads.find((d) => d.rawId)!.rawId!;
  const pbpId = (await download("pbp", csv(pbpColumns, pbp))).rawId!;
  assert.notEqual(weeklyId, pbpId);
  const [first] =
    await sql`select * from sports_feed.completions where game_id='2026_01_ATL_PIT'`;
  await observeNflCompletions(sql, pbpId);
  assert.equal(
    String(
      (
        await sql`select first_observed_at from sports_feed.completions where game_id='2026_01_ATL_PIT'`
      )[0].first_observed_at,
    ),
    String(first.first_observed_at),
  );
  const qa = await createNflHistoricalQa(sql, parseStatisticsCsv(weekly));
  const actor = { id: "qa-source-importer", role: "importer" as const };
  const runs = await Promise.all(
    Array.from({ length: 20 }, () =>
      reconcileNflBundle(
        sql,
        qa.id,
        weeklyId,
        pbpId,
        qa.mapping,
        permit,
        actor,
      ),
    ),
  );
  const original = runs[0].state;
  assert.equal(original.sources.length, 1);
  assert.equal(runs[0].issues.length, 0);
  const row = results(original).rows[0];
  assert.equal(
    row.players.find((p) => p.playerId === "gsis:00-0023459")?.centipoints,
    1254,
  );
  assert.equal(
    row.centipoints,
    row.players.reduce((sum, p) => sum + p.centipoints!, 0),
  );
  assert.equal(
    Number(
      (await sql`select count(*) n from sports_feed.bundle_evidence`)[0].n,
    ),
    1,
  );
  assert.throws(
    () =>
      finalise(
        original,
        { id: "qa-reviewer", role: "reviewer" },
        new Date().toISOString(),
      ),
    /window/,
  );
  await sql`update sports_feed.streams set purpose='member' where id=${qa.id}`;
  await assert.rejects(
    () =>
      reconcileNflBundle(
        sql,
        qa.id,
        weeklyId,
        pbpId,
        qa.mapping,
        permit,
        actor,
      ),
    /Six hours/,
  );
  await sql`update sports_feed.streams set purpose='historical-acceptance' where id=${qa.id}`;
  // Synthetic correction is disposable-database acceptance only, never uploaded.
  const altered = parseStatisticsCsv(weekly);
  altered[0].passing_yards = String(Number(altered[0].passing_yards) + 1);
  await sql`update sports_feed.postgame_cache set next_attempt=clock_timestamp() where resource=${nflResource("weekly", 2026)}`;
  const correctedId = (
    await download("weekly", csv(nflverseRequiredColumns, altered))
  ).rawId!;
  const corrected = (
    await reconcileNflBundle(
      sql,
      qa.id,
      correctedId,
      pbpId,
      qa.mapping,
      permit,
      actor,
    )
  ).state;
  assert.equal(corrected.sources.length, 2);
  assert.equal(results(corrected).rows[0].centipoints, row.centipoints! + 4);
  assert.equal(digest(corrected.sources[0]), digest(original.sources[0]));
  assert.equal(corrected.entries[0].rulesHash, original.entries[0].rulesHash);
  await assert.rejects(
    () =>
      new SportsFeedStore(sql).change(qa.id, (s) => {
        s.entries[0].cards.pop();
        s.audits.push({ ...s.audits.at(-1)!, sequence: s.audits.length + 1 });
        return s;
      }),
    /Immutable/,
  );
  // Whole transaction rolls back if the companion evidence is invalid.
  const journalBefore = Number(
    (await sql`select count(*) n from sports_feed.journal`)[0].n,
  );
  await assert.rejects(
    () =>
      new SportsFeedStore(sql).change(
        qa.id,
        (s) => {
          s.audits.push({ ...s.audits.at(-1)!, sequence: s.audits.length + 1 });
          return s;
        },
        correctedId,
        { rawId: 999999, fixtureId: qa.mapping.fixtureId },
      ),
    /Companion/,
  );
  assert.equal(
    Number((await sql`select count(*) n from sports_feed.journal`)[0].n),
    journalBefore,
  );
  // SQL read-boundary tests with explicitly local auth stubs. Hosted acceptance
  // separately exercises the existing real admission/session functions.
  await sql.unsafe(`create schema auth; create schema beta_private; create schema beta_fantasy;
    create role anon; create role authenticated; create role docked_beta_app;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;
    create function beta_private.owner_gameplay_identity(u uuid) returns boolean language sql as $$select u='00000000-0000-4000-8000-000000000001'::uuid$$;
    create function beta_fantasy.production_eligible() returns uuid language plpgsql as $$begin
      if auth.uid() is null then raise exception 'Admission required';end if;
      if beta_private.owner_gameplay_identity(auth.uid()) and auth.jwt()->>'aal'<>'aal2' then raise exception 'MFA required';end if;
      return auth.uid();end$$;`);
  await sql.unsafe(await readFile("sandbox/nfl-postgame-read.sql", "utf8"));
  const readAs = (id: string, aal: string) =>
    sql.begin(async (tx) => {
      await tx`set local role docked_beta_app`;
      await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${JSON.stringify({ aal })},true)`;
      return (await tx`select sports_feed.member_results() r`)[0].r;
    });
  assert.equal(
    (await readAs("00000000-0000-4000-8000-000000000001", "aal2")).length,
    1,
  );
  assert.equal(
    (await readAs("00000000-0000-4000-8000-000000000002", "aal1")).length,
    0,
  );
  await assert.rejects(
    () => readAs("00000000-0000-4000-8000-000000000001", "aal1"),
    /MFA/,
  );
  await assert.rejects(() => readAs("", "aal1"), /Admission/);
  await assert.rejects(
    () =>
      sql.begin(async (tx) => {
        await tx`set local role docked_beta_app`;
        await tx`select body from sports_feed.raw_revisions`;
      }),
    /permission/,
  );
  console.log(
    JSON.stringify({
      nflBundle: true,
      sourceEvidence:
        "Actual cached weekly/PBP plus explicitly synthetic correction in disposable DB",
      checks: [
        "20-way separate download lease",
        "20-way exactly-once reconciliation",
        "immutable first completion observation",
        "six-hour observation gate",
        "actual player/team arithmetic",
        "append-only correction",
        "atomic companion journal rollback",
        "finalisation window",
        "locked lineup integrity",
      ],
    }),
  );
}
