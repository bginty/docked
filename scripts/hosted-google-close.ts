/** Close only the synthetic acceptance role after every test order is terminal. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { wallet } from "../src/core/credits-sandbox";
async function main() {
  const root = process.cwd();
  const memberMode = process.env.DOCKED_HOSTED_MEMBER_ACCEPTANCE === "true";
  const schema = memberMode
    ? "store_member_acceptance"
    : "store_billing_acceptance";
  const member = memberMode
    ? "synthetic-store-member-20261101"
    : "synthetic-store-acceptance";
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820343)`;
      const [state] =
        await tx`select document from ${tx(schema)}.state where id for update`;
      const [open] =
        await tx`select count(*)::int count from ${tx(schema)}.store_receipts where status in ('PENDING','PURCHASED')`;
      const [jobs] =
        await tx`select count(*)::int count from ${tx(schema)}.store_outbox where state in ('pending','working')`;
      if (
        open.count ||
        jobs.count ||
        wallet(state.document, member).spendable !== 0
      )
        throw Error("Unsettled test operations; preserve recovery access");
      // Spent-refund holds and original issued test inventory remain auditable.
      // Shutdown never deletes them or pretends a held balance was recovered.
      await tx`update ${tx(schema)}.control set calls=1000 where id`;
      await tx`alter role docked_billing_test nologin`;
    });
    const [role] =
      await sql`select rolcanlogin from pg_roles where rolname='docked_billing_test'`;
    const evidence = {
      at: new Date().toISOString(),
      roleCanLogin: role.rolcanlogin,
      requestBudgetExhausted: true,
      testSpendable: 0,
      unsettledReceipts: 0,
      customerMutations: 0,
    };
    writeFileSync(
      resolve(
        root,
        memberMode
          ? "docs/qa/hosted-member-20261101/hosted-closed.json"
          : "docs/qa/public-play-readiness-20261031/hosted-closed.json",
      ),
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end();
    process.chdir(root);
  }
}
void main().catch(() => {
  console.error(
    "Acceptance shutdown not confirmed; retain private recovery files",
  );
  process.exitCode = 1;
});
