// Explicit owner-operated review only. Never called by the unattended importer.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
import core from "../src/core/scoring-engine.ts";
import store from "../src/server/sports-feed-store.ts";
const id = process.argv[2],
  reason = process.argv[3];
assert.match(id ?? "", /^beta-real:nfl:\d{4}:\d{1,2}$/);
assert.ok(reason && reason.length >= 20, "Provide a substantive review reason");
const sql = ownerDatabase(),
  app = ownerRuntimeDatabase();
try {
  const owner = JSON.parse(
    readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
  ).id;
  const [session] =
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>clock_timestamp()) order by created_at desc limit 1`;
  assert.ok(session, "Accepted owner MFA session required");
  await app.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: session.id, aal: "aal2" })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
    assert.equal(
      (await tx`select beta_fantasy.production_eligible() id`)[0].id,
      owner,
    );
  });
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820342)`;
    const [round] =
      await tx`select * from sports_feed.nfl_rounds where stream_id=${id} and purpose='member'`;
    assert.ok(round?.locked_at);
    const now = new Date(
      (await tx`select clock_timestamp() at`)[0].at,
    ).toISOString();
    const db = new Proxy(tx, {
      get(t, k) {
        if (k === "begin") return (fn) => t.savepoint(fn);
        const v = Reflect.get(t, k);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    const result = await new store.SportsFeedStore(db).change(id, (s) => {
      const next = core.finalise(s, { id: owner, role: "reviewer" }, now);
      if (!s.finalisedAt) next.audits.at(-1).reason += "; " + reason;
      return next;
    });
    assert.ok(result.finalisedAt);
    // Releases card commitment only after complete reviewed results. Historical snapshots remain.
    await tx`update beta_fantasy.competitions set scored_at=${result.finalisedAt} where id=${round.competition_id} and scored_at is null`;
  });
  console.log(
    "Reviewed NFL round finalised; no prizes, balances or historical lineups changed",
  );
} finally {
  await sql.end();
  await app.end();
}
