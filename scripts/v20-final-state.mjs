import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { wallet } from "../src/core/credits-sandbox.ts";
const sql = ownerDatabase();
try {
  const qa = JSON.parse(
    readFileSync("private-data/customer-hosted-qa/identity.json"),
  );
  const [q] =
    await sql`select r.enabled roster,a.enabled wallet from beta_private.friends_roster r join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${qa.id}`;
  assert.equal(q.roster, false);
  assert.equal(q.wallet, false);
  const [s] = await sql`select document from credits_sandbox.state where id`;
  const balance = wallet(s.document, "ef641248-67be-4c32-9b12-9205bfcee15b");
  assert.equal(balance.withdrawable, 0);
  const reference = "owner-authorized-barry-test-100000-20261011-v1";
  assert.equal(
    s.document.journal.filter((x) => x.id === reference + "_issue").length,
    1,
  );
  const access =
    await sql`select user_id::text,kind from credits_sandbox.access where enabled order by user_id`;
  assert.deepEqual(
    access.map((x) => x.user_id),
    [
      "623d1e69-d0f3-493f-9713-108e8c21469a",
      "ef641248-67be-4c32-9b12-9205bfcee15b",
    ],
  );
  const deployment = JSON.parse(
    readFileSync("docs/qa/friends-cutover/deployment-status.json"),
  );
  const live = await (
    await fetch("https://docked.com.au/api/beta-release")
  ).json();
  assert.equal(live.deploymentId, deployment.id);
  const auth = JSON.parse(readFileSync("private-data/vercel-cli/auth.json"));
  const privateShare = JSON.parse(
    readFileSync("private-data/signup-candidate-access.json"),
  );
  const token = new URL(privateShare.url).searchParams.get("_vercel_share");
  const response = await fetch(
    "https://api.vercel.com/v13/deployments/" +
      deployment.id +
      "?teamId=" +
      deployment.team,
    { headers: { Authorization: "Bearer " + auth.token } },
  );
  assert.ok(response.ok);
  const d = await response.json();
  assert.ok(!Object.hasOwn(d.protectionBypass ?? {}, token));
  const report = {
    at: new Date().toISOString(),
    passed: true,
    deployment: live.deploymentId,
    commit: live.commit,
    onlyOwnerBarryWalletAccess: true,
    syntheticQaDisabled: true,
    temporaryShareRevoked: true,
    barryGrantReference: reference,
    barryTestBalance: balance,
    realFundsEnabled: false,
    physicalS26Acceptance: "Pending Barry",
    messagesSent: 0,
  };
  writeFileSync(
    "docs/qa/android-v20/final-state.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end();
}
