// Exact existing Docked project, operator-run ingestion only. No Auth mutation,
// inventory changes, external admissions, genuine competition creation or cron activation.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
import bundle from "../src/server/nflverse-bundle.ts";
import reconcile from "../src/server/nfl-postgame-reconcile.ts";
import evidence from "../src/core/nflverse-evidence.ts";
import engine from "../src/core/scoring-engine.ts";
import qaHelpers from "./nfl-postgame-qa.ts";
const { downloadNflDataset, nflResource, retainedNflSource } = bundle;
const { reconcileNflBundle } = reconcile;
const { inspectNflRosters } = evidence;
const { results } = engine;
const { createNflHistoricalQa } = qaHelpers;
assert.equal(process.argv[2], "--ingest-and-verify");
const sql = ownerDatabase(),
  app = ownerRuntimeDatabase();
const report = {
  at: new Date().toISOString(),
  projectRef,
  scope:
    "Hosted operator ingestion + restricted runtime SQL read; not browser/session or future live-match acceptance",
  checks: [],
  sourceRevisions: [],
};
const permit = {
  provider: "nflverse",
  enabled: true,
  scope: "isolated-free-beta",
  automatedDownload: true,
  fantasyUse: true,
  storage: true,
  derivedUse: true,
  evidence: "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md",
  expiresAt: "2026-11-10T00:00:00.000Z",
  rawRetentionDays: 30,
};
const fingerprint = async () =>
  JSON.stringify(
    await sql`select
 (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from beta_fantasy.cards t) beta_cards,
 (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from beta_fantasy.editions t) beta_editions,
 (select count(*) from beta_fantasy.ownership_events) beta_ownership,
 (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from fantasy.cards t) production_cards,
 (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from fantasy.editions t) production_editions`,
  );
try {
  const before = await fingerprint();
  const raw = {};
  for (const dataset of ["weekly", "pbp", "rosters"]) {
    const outcome = await downloadNflDataset(sql, permit, dataset, 2026);
    const [cache] =
      await sql`select raw_id from sports_feed.postgame_cache where resource=${nflResource(dataset, 2026)}`;
    if (!cache?.raw_id)
      throw Error(
        "No retained " +
          dataset +
          " source; cooldown cannot substitute for data",
      );
    raw[dataset] = await retainedNflSource(
      sql,
      Number(cache.raw_id),
      dataset,
      2026,
    );
    report.sourceRevisions.push({
      dataset,
      status: outcome.status,
      id: Number(raw[dataset].id),
      projectionHash: raw[dataset].body_hash,
      sourceSha256: raw[dataset].body.sourceSha256,
      sourceModifiedAt: raw[dataset].body.sourceModifiedAt,
      rows: raw[dataset].body.rows.length,
      expiresAt: raw[dataset].expires_at,
    });
  }
  const roster = inspectNflRosters(raw.rosters.body.rows, 2026);
  report.roster = {
    ...roster,
    players: undefined,
    supportedPlayers: roster.players.length,
    unmapped: raw.rosters.body.rows.filter(
      (r) =>
        ["QB", "RB", "WR", "TE"].includes(r.position) &&
        !/^\d{2}-\d{7}$/.test(r.gsis_id),
    ),
  };
  const qa = await createNflHistoricalQa(sql, raw.weekly.body.rows);
  const outcome = await reconcileNflBundle(
    sql,
    qa.id,
    Number(raw.weekly.id),
    Number(raw.pbp.id),
    qa.mapping,
    permit,
    { id: "owner-authorised-postgame-operator", role: "importer" },
  );
  assert.equal(outcome.issues.length, 0);
  const output = results(outcome.state);
  const repeated = await reconcileNflBundle(
    sql,
    qa.id,
    Number(raw.weekly.id),
    Number(raw.pbp.id),
    qa.mapping,
    permit,
    { id: "owner-authorised-postgame-operator", role: "importer" },
  );
  assert.equal(repeated.state.sources.length, outcome.state.sources.length);
  report.checks.push(
    "Actual weekly + PBP imported, idempotent repeat, complete seven-player QA lineup",
  );
  const owner = JSON.parse(
    readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
  ).id;
  const session = (
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>now()) order by created_at desc limit 1`
  )[0]?.id;
  assert.ok(session, "Existing owner MFA session unavailable; do not reset");
  const read = (id = owner, aal = "aal2") =>
    app.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: id, session_id: session, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
      return (await tx`select sports_feed.member_results() records`)[0].records;
    });
  const records = await read(),
    visible = records.find((r) => r.id === qa.id);
  assert.ok(visible);
  assert.equal(visible.view.rows[0].centipoints, output.rows[0].centipoints);
  assert.equal(visible.view.rows[0].member, undefined);
  await assert.rejects(() => read(owner, "aal1"));
  await assert.rejects(() => read(randomUUID()));
  await assert.rejects(() => app`select * from sports_feed.raw_revisions`);
  await assert.rejects(
    () =>
      app`insert into sports_feed.streams(id) values('beta-real:unauthorised')`,
  );
  report.checks.push(
    "Existing owner AAL2 admitted; owner AAL1/other identity denied; runtime raw reads and writes denied",
  );
  assert.equal(await fingerprint(), before);
  report.checks.push(
    "Beta/production holdings, editions, scarcity and ownership counts unchanged",
  );
  report.actualResults = {
    period: output.period,
    status: output.rows[0].status,
    total: output.rows[0].centipoints / 100,
    players: output.rows[0].players.map((p) => ({
      id: p.playerId,
      points: p.centipoints / 100,
      breakdown: p.matches[0].score.parts,
    })),
    completion: (
      await sql`select first_observed_at from sports_feed.completions where game_id='2026_01_ATL_PIT'`
    )[0].first_observed_at,
  };
  report.readView = records;
  mkdirSync("docs/qa/postgame", { recursive: true });
  writeFileSync(
    "docs/qa/postgame/hosted-ingestion.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      ...report,
      readView: undefined,
      actualResults: {
        ...report.actualResults,
        players: report.actualResults.players.map((p) => ({
          id: p.id,
          points: p.points,
        })),
      },
    }),
  );
} finally {
  await app.end();
  await sql.end();
}
