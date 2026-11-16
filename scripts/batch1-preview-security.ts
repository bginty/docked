/** Runtime-role denials in disconnected synthetic rehearsal, not hosted Auth. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { syntheticDatabase } from "./lib/batch1-preview-local";
import {
  acceptanceDocs,
  acceptancePrivate,
} from "./lib/batch1-acceptance-profile";
const fixtures = JSON.parse(
  readFileSync(acceptancePrivate + "/fixtures.json", "utf8"),
);
const sql = syntheticDatabase(true),
  operator = syntheticDatabase();
async function main() {
  const checks: string[] = [];
  try {
    const [identity] = await sql`select current_user,session_user`;
    assert.equal(identity.current_user, "docked_pack_acceptance");
    assert.equal(identity.session_user, identity.current_user);
    for (const statement of [
      "select * from auth.users",
      "select * from auth.sessions",
      "select * from credits_sandbox.state",
      "select * from commercial_billing.definitions",
      "select * from beta_public.profiles",
      "select * from b1_acceptance.auth_users",
      "select * from b1_acceptance.window",
      "set role postgres",
      "set role docked_pack_acceptance_owner",
    ]) {
      await assert.rejects(
        () => sql.unsafe(statement),
        (e: any) => e.code === "42501",
      );
      checks.push("denied: " + statement);
    }
    const [before] =
      await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`;
    const member = fixtures.accounts[1];
    for (const [aal, session] of [
      ["aal1", member.session],
      ["aal2", fixtures.accounts[0].session],
    ]) {
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx`select set_config('request.jwt.claim.sub',${member.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: member.id, aal, session_id: session })},true)`;
            await tx`update b1_credits_sandbox.state set revision=revision where id`;
          }),
        (e: any) => e.message.includes("Active synthetic AAL2"),
      );
      checks.push(
        aal === "aal1"
          ? "ordinary tester AAL1 denied"
          : "another-account session denied",
      );
    }
    const [window] =
      await operator`select starts,expires from b1_acceptance.window where id`;
    try {
      await operator`update b1_acceptance.window set starts=now()-interval '2 hours',expires=now()-interval '1 hour' where id`;
      assert.equal(
        (
          await sql`select b1_beta_private.admitted(${member.id}::uuid) allowed`
        )[0].allowed,
        false,
      );
      checks.push("expired window denies existing admission");
    } finally {
      await operator`update b1_acceptance.window set starts=${window.starts},expires=${window.expires} where id`;
    }
    assert.equal(
      (
        await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`
      )[0].hash,
      before.hash,
    );
    writeFileSync(
      acceptanceDocs + "/synthetic-security-rehearsal.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          localOnly: true,
          identity,
          checks,
          stateUnchanged: true,
          actualHostedAcceptance: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        checks: checks.length,
        stateUnchanged: true,
        localOnly: true,
      }),
    );
  } finally {
    await Promise.all([sql.end({ timeout: 3 }), operator.end({ timeout: 3 })]);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
