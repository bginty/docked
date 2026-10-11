// Close only this labelled synthetic acceptance; preserve all real/locked records.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase();
try {
  await db.begin(async (tx) => {
    assert.equal(
      (await tx`select email from auth.users where id=${qa.id}`)[0].email,
      qa.email,
    );
    const entries =
      await tx`select e.* from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id join sports_feed.nfl_rounds r on r.competition_id=c.id where e.user_id=${qa.id} and c.locks_at>clock_timestamp() and r.locked_at is null for update of e,c,r`;
    for (const entry of entries) {
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','isolated_qa_draft_removed_before_lock',${qa.id},${tx.json({ reason: "Internal browser draft only, no real competitive entry", entry })})`;
      await tx`delete from sports_feed.stream_members m using sports_feed.nfl_rounds r,beta_fantasy.competitions c where m.stream_id=r.stream_id and r.competition_id=c.id and c.id=${entry.competition_id} and m.user_id=${qa.id} and r.locked_at is null and c.locks_at>clock_timestamp()`;
      await tx`delete from beta_fantasy.entries e using beta_fantasy.competitions c,sports_feed.nfl_rounds r where e.competition_id=c.id and r.competition_id=c.id and e.user_id=${qa.id} and e.competition_id=${entry.competition_id} and c.locks_at>clock_timestamp() and r.locked_at is null`;
    }
    await tx`update beta_private.admission_control set testers_enabled=false`;
    await tx`update beta_private.friends_control set enabled=false`;
    console.log(
      JSON.stringify({
        internalUnlockedDraftsRemoved: entries.length,
        externalGatesClosed: true,
      }),
    );
  });
} finally {
  await db.end();
}
