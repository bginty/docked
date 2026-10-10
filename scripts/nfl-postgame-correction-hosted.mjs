// Synthetic fault injection inside a transaction that ALWAYS rolls back.
// No altered provider statistic, result or audit record is committed.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import core from "../src/core/scoring-engine.ts";
import storeModule from "../src/server/sports-feed-store.ts";
const { importStatistics, results, digest } = core;
const { SportsFeedStore } = storeModule;
const sql = ownerDatabase(),
  id = "beta-real:qa:nfl-atl-pit-2026";
const report = {
  at: new Date().toISOString(),
  projectRef,
  scope:
    "Hosted rolled-back SYNTHETIC correction on historical QA stream; NOT an observed provider correction",
  pass: false,
};
try {
  const [before] =
    await sql`select revision,state_hash,body,raw_id from sports_feed.journal where stream_id=${id} order by revision desc limit 1`;
  const owner = JSON.parse(
    readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
  ).id;
  const session = (
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>now()) order by created_at desc limit 1`
  )[0]?.id;
  assert.ok(session);
  await assert.rejects(
    () =>
      sql.begin(async (tx) => {
        const db = new Proxy(tx, {
          get(target, key) {
            if (key === "begin") return (fn) => target.savepoint(fn);
            const v = Reflect.get(target, key);
            return typeof v === "function" ? v.bind(target) : v;
          },
        });
        const store = new SportsFeedStore(db);
        const now = new Date().toISOString();
        const source = structuredClone(before.body.sources.at(-1));
        source.revision++;
        source.observedAt = now;
        source.players[0].stats.passing_yards++;
        const originalTotal = results(before.body).rows[0].centipoints;
        const next = await store.change(
          id,
          (s) =>
            importStatistics(
              s,
              source,
              { id: "ROLLBACK-ONLY-QA", role: "reviewer" },
              now,
              "SYNTHETIC correction acceptance; rollback required",
              {
                provider: "nflverse",
                competition: "NFL",
                intendedUse: "isolated-free-beta",
                fantasyUse: true,
                storage: true,
                evidence:
                  "https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md",
                reviewExpires: "2026-11-10T00:00:00.000Z",
                maxAgeSeconds: 86400,
              },
            ),
          before.raw_id,
        );
        assert.equal(results(next).rows[0].centipoints, originalTotal + 4);
        assert.equal(digest(next.entries), digest(before.body.entries));
        assert.equal(digest(next.sources[0]), digest(before.body.sources[0]));
        await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: session, aal: "aal2" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
        const view = (
          await tx`select sports_feed.member_results() r`
        )[0].r.find((r) => r.id === id);
        assert.equal(view.view.rows[0].centipoints, originalTotal + 4);
        assert.equal(
          view.view.rows[0].players[0].matches[0].revision,
          source.revision,
        );
        throw Error("QA_ROLLBACK_CONFIRMED");
      }),
    /QA_ROLLBACK_CONFIRMED/,
  );
  const [after] =
    await sql`select revision,state_hash from sports_feed.journal where stream_id=${id} order by revision desc limit 1`;
  assert.equal(after.revision, before.revision);
  assert.equal(after.state_hash, before.state_hash);
  report.pass = true;
  report.checks = [
    "one-yard synthetic correction adds 0.04, not duplicate total",
    "original snapshot and lineup preserved",
    "member read function returns corrected breakdown/revision inside operator rollback transaction; restricted-role access is separately tested",
    "transaction rollback restores exact original journal",
  ];
  writeFileSync(
    "docs/qa/postgame/hosted-correction-rollback.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
