/** Owner-authorised isolated environment only. No customer-account admission. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { hostedMemberFixture } from "./hosted-member-fixture";
import { storeAccountId } from "../src/server/store-purchase-verification";

async function main() {
  const root = process.cwd(),
    dir = join(process.env.USERPROFILE!, ".docked-secrets");
  const target = join(dir, "hosted-member-acceptance.json");
  if (existsSync(target))
    throw Error("Recover existing session; never overwrite its keys");
  const initial = hostedMemberFixture();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  try {
    const [before] =
      await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
    const [role] =
      await sql`select rolcanlogin,rolsuper,rolbypassrls,has_schema_privilege('docked_billing_test','credits_sandbox','USAGE') customer_access from pg_roles where rolname='docked_billing_test'`;
    if (
      !role ||
      role.rolcanlogin ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.customer_access
    )
      throw Error("Unsafe role state");
    const [{ count }] =
      await sql`select count(*)::int count from store_member_acceptance.state`;
    if (count !== 0)
      throw Error("Existing isolated state cannot be overwritten");
    const base = JSON.parse(
      readFileSync(
        "private-data/production/beta-runtime-connection.json",
        "utf8",
      ),
    );
    const url = new URL(base.databaseUrl),
      password = randomBytes(32).toString("hex");
    const member = "synthetic-store-member-20261101",
      bindingSecret = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 6 * 3600_000;
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
      account: storeAccountId(member, bindingSecret),
      member,
      bindingSecret,
      memberAcceptance: true,
    };
    writeFileSync(target, JSON.stringify(config), { flag: "wx" });
    await sql.begin(async (tx) => {
      await tx`insert into store_member_acceptance.state values(true,0,${tx.json(initial as any)})`;
      await tx.unsafe(
        `alter role docked_billing_test login password '${password}' valid until '${new Date(expiresAt).toISOString()}'`,
      );
    });
    const [after] =
      await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw Error("Customer state changed; investigate");
    const evidence = {
      at: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      schema: "store_member_acceptance",
      customerBefore: before,
      customerAfter: after,
      customerAccess: false,
      permanentInventory: false,
      products: initial.economy!.activeProductVersions!.length,
    };
    mkdirSync(resolve(root, "docs/qa/hosted-member-20261101"), {
      recursive: true,
    });
    writeFileSync(
      resolve(root, "docs/qa/hosted-member-20261101/provision.json"),
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
    "Isolated provisioning not confirmed; private recovery state preserved",
  );
  process.exitCode = 1;
});
