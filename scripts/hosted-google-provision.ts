import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { initialCredits } from "../src/core/credits-sandbox";
import { newCreditOnly } from "../src/core/credit-only";
async function main() {
  const root = process.cwd(),
    main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
  const target = join(
    process.env.USERPROFILE!,
    ".docked-secrets/hosted-google-acceptance.json",
  );
  if (existsSync(target))
    throw Error(
      "Existing acceptance session must be recovered, not overwritten",
    );
  process.chdir(main);
  const sql = ownerDatabase();
  try {
    const [r] =
      await sql`select rolname,rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname='docked_billing_test'`;
    if (!r || r.rolsuper || r.rolbypassrls || r.rolcanlogin)
      throw Error("Unexpected role state");
    const [p] =
      await sql`select has_schema_privilege('docked_billing_test','credits_sandbox','USAGE') customer_access`;
    if (p.customer_access) throw Error("Customer schema is accessible");
    const rows =
      await sql`select count(*)::integer count from store_billing_acceptance.state`;
    if (rows[0].count !== 0) throw Error("Existing state cannot be reset");
    const initial = initialCredits();
    initial.creditOnly = newCreditOnly();
    const password = randomBytes(32).toString("hex"),
      expiresAt = Date.now() + 3 * 3600_000;
    const base = JSON.parse(
      readFileSync(
        "private-data/production/beta-runtime-connection.json",
        "utf8",
      ),
    );
    const url = new URL(base.databaseUrl);
    url.username = "docked_billing_test.pojoymtniryarxxunyvz";
    url.password = password;
    const config = {
      secret: randomBytes(32).toString("hex"),
      expiresAt,
      database: url.href,
      databaseCa: readFileSync(
        resolve(root, "certs/supabase-prod-ca-2021.crt"),
        "utf8",
      ),
      encryptionKey: randomBytes(32).toString("hex"),
      account: randomBytes(32).toString("hex"),
      member: "synthetic-store-acceptance",
    };
    // Secure recovery file precedes DB activation; never print its contents.
    writeFileSync(target, JSON.stringify(config), { flag: "wx" });
    await sql.begin(async (tx) => {
      await tx`insert into store_billing_acceptance.state values(true,0,${tx.json(initial as any)})`;
      await tx.unsafe(
        `alter role docked_billing_test login password '${password}' valid until '${new Date(expiresAt).toISOString()}'`,
      );
    });
    const [customer] =
      await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
    writeFileSync(
      resolve(
        root,
        "docs/qa/public-play-readiness-20261031/hosted-acceptance-provision.json",
      ),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
          schema: "store_billing_acceptance",
          customerRevision: customer.revision,
          customerHash: customer.hash,
          customerSchemaAccess: false,
          seedHash: createHash("sha256")
            .update(JSON.stringify(initial))
            .digest("hex"),
        },
        null,
        2,
      ),
    );
    console.log(
      "Private synthetic ledger initialized; dedicated role expires in three hours. Customer wallet untouched.",
    );
  } finally {
    await sql.end();
    process.chdir(root);
  }
}
void main().catch(() => {
  console.error("Provisioning not confirmed; private configuration preserved.");
  process.exitCode = 1;
});
