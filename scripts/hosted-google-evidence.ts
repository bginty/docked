/** Read-only acceptance evidence: never emits tokens, customer IDs or documents. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
async function main() {
  const root = process.cwd();
  const before = JSON.parse(
    readFileSync(
      "docs/qa/public-play-readiness-20261031/hosted-acceptance-provision.json",
      "utf8",
    ),
  );
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  try {
    await sql.begin(async (tx) => {
      await tx`set transaction read only`;
      const [customer] =
        await tx`select revision,md5(document::text) hash from credits_sandbox.state where id`;
      const receipts =
        await tx`select product->>'id' product,status,count(*)::int count from store_billing_acceptance.store_receipts group by product->>'id',status order by product->>'id',status`;
      const outbox =
        await tx`select state,count(*)::int count from store_billing_acceptance.store_outbox group by state`;
      const events =
        await tx`select status,count(*)::int count from store_billing_acceptance.store_events group by status`;
      const [journal] =
        await tx`select count(distinct journal)::int entries,coalesce(sum(credits),0)::text net from store_billing_acceptance.lines`;
      const [role] =
        await tx`select rolcanlogin,rolsuper,rolbypassrls,has_schema_privilege('docked_billing_test','credits_sandbox','USAGE') customer_schema_access from pg_roles where rolname='docked_billing_test'`;
      const evidence = {
        at: new Date().toISOString(),
        receipts,
        outbox,
        events,
        journal,
        role,
        customerRevision: customer.revision,
        customerHash: customer.hash,
        customerStateUnchanged:
          customer.hash === before.customerHash &&
          String(customer.revision) === String(before.customerRevision),
      };
      writeFileSync(
        resolve(
          root,
          "docs/qa/public-play-readiness-20261031/hosted-database-evidence.json",
        ),
        JSON.stringify(evidence, null, 2),
      );
      console.log(JSON.stringify(evidence));
    });
  } finally {
    await sql.end();
    process.chdir(root);
  }
}
void main().catch(() => {
  console.error("Hosted read-only evidence failed; no secrets logged");
  process.exitCode = 1;
});
