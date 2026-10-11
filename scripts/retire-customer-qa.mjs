// Reversible disable of the exact internal synthetic account after acceptance.
// Never deletes/recycles a tester place, cards, identity or audit history.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const qa = JSON.parse(
  readFileSync("private-data/customer-hosted-qa/identity.json"),
);
assert.match(qa.email, /^docked-internal-qa-[a-f0-9]+@example\.invalid$/);
const db = ownerDatabase();
try {
  const result = await db.begin(async (tx) => {
    assert.equal(
      (await tx`select email from auth.users where id=${qa.id}`)[0].email,
      qa.email,
    );
    assert.equal(
      (
        await tx`select count(*)::int n from beta_fantasy.entries where user_id=${qa.id}`
      )[0].n,
      0,
    );
    const roster = (
      await tx`select * from beta_private.friends_roster where user_id=${qa.id} for update`
    )[0];
    assert.equal(roster.email, qa.email);
    const before =
      await tx`select id,visibility,status from beta_private.social_profiles where user_id=${qa.id}`;
    await tx`update beta_private.friends_roster set enabled=false where user_id=${qa.id}`;
    await tx`update beta_private.social_profiles set visibility='private' where user_id=${qa.id}`;
    if (roster.enabled)
      await tx`insert into beta_private.audit_events(actor,action,subject,details) values('qa-operator','internal_customer_qa_disabled_after_acceptance',${qa.id},${tx.json({ reason: "Exclude synthetic member from friends gameplay/discovery; preserve inventory/history and lifetime place", previous: { enabled: roster.enabled, profiles: before }, result: { enabled: false, visibility: "private" } })})`;
    assert.equal(
      (
        await tx`select beta_private.beta_gameplay_identity(${qa.id}::uuid) allowed`
      )[0].allowed,
      false,
    );
    return {
      qaAccessDenied: true,
      qaProfilePrivate: true,
      historyPreserved: true,
      lifetimeTesterCount: (
        await tx`select count(*)::int n from beta_private.friends_roster`
      )[0].n,
    };
  });
  const report = { at: new Date().toISOString(), ...result };
  writeFileSync(
    "docs/qa/friends-cutover/qa-retired.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await db.end();
}
