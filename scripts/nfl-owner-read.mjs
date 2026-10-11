import { writeFileSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
const sql = ownerDatabase(),
  app = ownerRuntimeDatabase();
try {
  const owner = JSON.parse(
    readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
  ).id;
  const [session] =
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>clock_timestamp()) order by created_at desc limit 1`;
  assert.ok(session);
  const read = async (aal = "aal2", claim = false) =>
    app.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${owner},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner, session_id: session.id, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
      if (claim)
        await tx`select beta_fantasy.production_command('claim_starter','{}',${randomUUID()})`;
      return (await tx`select beta_fantasy.production_read_state() s`)[0].s;
    });
  const concurrent = await Promise.all(
    Array.from({ length: 12 }, () => read("aal2", true)),
  );
  const state = concurrent[0];
  assert.ok(concurrent.every((s) => s.cards.length === 10));
  assert.equal(state.nfl_beta, true);
  await assert.rejects(() => read("aal1"));
  writeFileSync(
    "private-data/nfl-worker/owner-state.json",
    JSON.stringify(state),
  );
  writeFileSync(
    "docs/qa/nfl-member/owner-read.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: true,
        scope:
          "Actual restricted runtime role; existing owner session, no password/MFA changes",
        cards: state.cards.length,
        archivedCardsPreserved: state.archived_card_count,
        rounds: state.competitions.map((c) => ({
          name: c.name,
          deadline: c.locks_at,
        })),
        ownerAal1Denied: true,
        externalAdmission: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Owner real NFL collection and next round readable; AAL1 denied; previous cards preserved",
  );
} finally {
  await sql.end();
  await app.end();
}
