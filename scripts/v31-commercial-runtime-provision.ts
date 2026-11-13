/** Initial, explicitly approved dormant role. Never resets an existing login. */
import assert from "node:assert/strict";
import { randomBytes, createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { CommercialLedger } from "../src/server/commercial-ledger";
import {
  authority,
  blob,
  root,
  privateDir,
  evidence,
  hash,
  readJson,
  writePrivate,
  writeEvidence,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const mode = process.argv[2];
assert(["provision", "verify"].includes(mode));
const completeInitialVerification = process.argv.includes("--complete-initial-verification");
assert(!completeInitialVerification || mode === "verify");
const p = authority("inactive-commercial-runtime");
const role = "docked_commercial_runtime";
const privateFile = privateDir + "/runtime-initial.private.json";
async function baseline(tx: any) {
  const [r] = await tx`select
    (select count(*)::int from commercial_billing.definitions) definitions,
    (select sum(legacy_issued)::int from commercial_billing.definitions) consumed,
    (select count(*)::int from commercial_billing.definitions where approved) approved,
    (select count(*)::int from commercial_billing.accounts) accounts,
    (select count(*)::int from commercial_billing.receipts) receipts,
    (select count(*)::int from commercial_billing.cards) cards,
    (select count(*)::int from commercial_billing.control where environment='commercial' and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled) closed`;
  assert.deepEqual(r, {
    definitions: 6540,
    consumed: 888,
    approved: 0,
    accounts: 0,
    receipts: 0,
    cards: 0,
    closed: 1,
  });
  return r;
}
async function main() {
  const old = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(old);
  try {
    const db = readJson(evidence + "/database-applied.json");
    assert.equal(db.sourceCommit, sourceCommit);
    assert.equal(db.packageSha256, packageSha256);
    if (mode === "provision") {
      assert(
        !existsSync(privateFile),
        "Initial material exists: inspect; never regenerate/reset",
      );
      const b = readJson(
        root +
          "/private-data/v31-revenue-launch-20261113/closed-gate-founder-approved.private.json",
      );
      assert(b.approved);
      const result = await sql.begin(
        "isolation level repeatable read",
        async (tx: any) => {
          await tx`set local lock_timeout='3s'`;
          await tx`set local statement_timeout='60s'`;
          const counts = await baseline(tx);
          assert.equal(
            (
              await tx`select count(*)::int n from pg_roles where rolname=${role}`
            )[0].n,
            0,
          );
          const password = randomBytes(48).toString("base64url");
          const url = new URL(
            readFileSync(
              "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/production/provider-config/supabase/.temp/pooler-url",
              "utf8",
            ).trim(),
          );
          assert(url.hostname.endsWith(".pooler.supabase.com"));
          assert(
            decodeURIComponent(url.username).endsWith("." + p.databaseProject),
          );
          url.username = role + "." + p.databaseProject;
          url.password = password;
          url.port = "5432";
          url.searchParams.set("sslmode", "verify-full");
          const google = readJson(
            process.env.USERPROFILE +
              "/.docked-secrets/google-play-test-verifier.json",
          );
          assert.equal(google.project_id, "docked-play-verification");
          assert(google.private_key.startsWith("-----BEGIN PRIVATE KEY-----"));
          const material = {
            DOCKED_COMMERCIAL_DATABASE_URL: url.toString(),
            DOCKED_COMMERCIAL_REFERENCE_KEY_ID: "v1",
            DOCKED_COMMERCIAL_REFERENCE_KEY: randomBytes(32).toString("hex"),
            DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET:
              randomBytes(32).toString("base64url"),
            DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL: google.client_email,
            DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY: google.private_key,
            DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET:
              randomBytes(32).toString("base64url"),
          };
          // Persist a recoverable private copy before committing the new login.
          writePrivate("runtime-initial.private.json", material);
          const salt = randomBytes(16),
            salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
          const client = createHmac("sha256", salted)
            .update("Client Key")
            .digest();
          const stored = createHash("sha256").update(client).digest("base64");
          const server = createHmac("sha256", salted)
            .update("Server Key")
            .digest("base64");
          const scram =
            "SCRAM-SHA-256$4096:" +
            salt.toString("base64") +
            "$" +
            stored +
            ":" +
            server;
          await tx.unsafe(blob(p.dormantRoleProposal.file).toString());
          // The SQL receives a SCRAM verifier, never a plaintext password.
          await tx.unsafe(
            "alter role docked_commercial_runtime login password '" +
              scram +
              "'",
          );
          salted.fill(0);
          client.fill(0);
          const [r] =
            await tx`select rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolinherit,rolcanlogin,rolconnlimit from pg_roles where rolname=${role}`;
          assert.deepEqual(r, {
            rolname: role,
            rolsuper: false,
            rolbypassrls: false,
            rolcreaterole: false,
            rolcreatedb: false,
            rolreplication: false,
            rolinherit: true,
            rolcanlogin: true,
            rolconnlimit: 6,
          });
          const memberships =
            await tx`select r.rolname role,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid where a.member=${role}::regrole order by r.rolname`;
          assert.deepEqual(
            [...memberships],
            [
              {
                role: "docked_commercial_app",
                admin_option: false,
                inherit_option: true,
                set_option: false,
              },
            ],
          );
          assert.deepEqual(await baseline(tx), counts);
          return {
            at: new Date().toISOString(),
            sourceCommit,
            packageSha256,
            role: r,
            memberships,
            counts,
            secretFields: Object.keys(material),
            initialMaterialSha256: hash(JSON.stringify(material)),
            existingSecretsChanged: false,
            newTableGrants: 0,
            customerMutations: 0,
          };
        },
      );
      writeEvidence("runtime-provisioned.json", result);
    }
    const values = readJson(privateFile);
    const provisioned = readJson(evidence + "/runtime-provisioned.json");
    assert.equal(provisioned.sourceCommit, sourceCommit);
    assert.equal(provisioned.packageSha256, packageSha256);
    assert.equal(hash(JSON.stringify(values)), provisioned.initialMaterialSha256);
    if (completeInitialVerification)
      assert(!existsSync(evidence + "/runtime-verified.json"));
    // Resolve relation OIDs as the operator. Resolving private.outbox by name as
    // the restricted login itself correctly fails without schema USAGE; this
    // must not be mistaken for a bad credential or repaired with a new grant.
    const [protectedRelations] = await sql`select 'private.outbox'::regclass::oid outbox,'auth.users'::regclass::oid auth`;
    const connection = postgres(values.DOCKED_COMMERCIAL_DATABASE_URL, {
      ...databaseConnectionOptions(values.DOCKED_COMMERCIAL_DATABASE_URL, {
        DATABASE_SSL_CA_FILE: root + "/certs/supabase-prod-ca-2021.crt",
      }),
      max: 1,
      prepare: false,
      connect_timeout: 20,
    });
    try {
      const result = await connection.begin(
        "isolation level repeatable read read only",
        async (tx: any) => {
          const [r] =
            await tx`select current_user name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolconnlimit,pg_has_role(current_user,'docked_commercial_app','member') permitted from pg_roles where rolname=current_user`;
          assert.deepEqual(r, {
            name: role,
            rolsuper: false,
            rolbypassrls: false,
            rolcreaterole: false,
            rolcreatedb: false,
            rolreplication: false,
            rolconnlimit: 6,
            permitted: true,
          });
          const [x] =
            await tx`select has_table_privilege(current_user,${protectedRelations.outbox}::oid,'select,insert,update,delete') outbox,has_table_privilege(current_user,${protectedRelations.auth}::oid,'select,insert,update,delete') auth,has_schema_privilege(current_user,'public','create') public_create`;
          assert.deepEqual(x, {
            outbox: false,
            auth: false,
            public_create: false,
          });
          return { role: r, denied: x, counts: await baseline(tx) };
        },
      );
      const ledger: any = new CommercialLedger(connection, "commercial", {
        active: "v1",
        values: {
          v1: Buffer.from(values.DOCKED_COMMERCIAL_REFERENCE_KEY, "hex"),
        },
      });
      const synthetic = "synthetic-receipt-local-only",
        bound = "synthetic-binding";
      const encrypted = ledger.encrypt(synthetic, bound);
      assert.equal(ledger.decrypt(encrypted, bound), synthetic);
      assert.throws(() => ledger.decrypt(encrypted, "wrong-binding"));
      const report = {
        at: new Date().toISOString(),
        sourceCommit,
        packageSha256,
        ...result,
        receiptEncryptionRoundTrip: true,
        wrongBindingDenied: true,
        productionWrites: 0,
        commercialService: false,
        initialProvisionVerificationResumed: completeInitialVerification,
      };
      writeEvidence(
        mode === "provision" || completeInitialVerification
          ? "runtime-verified.json"
          : "runtime-reverified.json",
        report,
      );
      console.log(JSON.stringify(report));
    } finally {
      await connection.end({ timeout: 5 });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e: any) => {
  writeFileSync(privateDir + "/runtime-error.private.txt", String(e), {
    mode: 0o600,
  });
  console.error(
    "Runtime operator stopped; private diagnostic retained. Do not regenerate or retry without inspection.",
  );
  process.exitCode = 1;
});
