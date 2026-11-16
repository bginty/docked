/** Explicitly approved Preview-only namespace creation. Never a Production operator. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import {
  verifyPreviewNamespaces,
  type PreviewNamespace,
} from "./lib/batch1-preview-schema";
import {
  acceptanceDocs,
  acceptancePrivate,
  packOnly,
} from "./lib/batch1-acceptance-profile";
assert(
  packOnly,
  "The larger Preview proposal is withdrawn; use reviewed --pack-only package",
);
const dir = acceptanceDocs,
  priv = acceptancePrivate;
const hash = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
  readFileSync(dir + "/preview-package.json", "utf8"),
);
assert.equal(manifest.projectRef, "bckkllmndoxzpzdqrevb");
for (const f of manifest.operatorDependencies)
  assert.equal(hash(readFileSync(f.path)), f.sha256, f.path);
const bytes = manifest.files.map((f: any) => {
  const b = readFileSync(f.path);
  assert.equal(hash(b), f.sha256, f.path);
  return b.toString();
});
assert.equal(
  hash(readFileSync("scripts/batch1-preview-operator.ts")),
  manifest.operatorSha256,
);
if (!process.argv.includes("--apply-approved")) {
  console.log(
    JSON.stringify({ exactPreviewPackageVerified: true, write: false }),
  );
  process.exit(0);
}
const approval = JSON.parse(
  readFileSync(priv + "/preview-approval.json", "utf8"),
);
assert.equal(
  approval.packageSha256,
  hash(readFileSync(dir + "/preview-package.json")),
);
assert(
  approval.explicitFounderApproval === true &&
    Date.parse(approval.at) <= Date.now() &&
    Date.now() - Date.parse(approval.at) < 86400000,
  "Fresh explicit Preview approval required",
);
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, manifest.projectRef);
const u = new URL(c.databaseUrl);
assert.equal(decodeURIComponent(u.username), "postgres." + c.projectRef);
assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
const sql = postgres(u.href, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const secretFile =
  process.env.USERPROFILE +
  "/.docked-secrets/batch1-preview-runtime-20261116.json";
async function main() {
  try {
    assert(
      !existsSync(secretFile),
      "Existing operation record: inspect before any rerun",
    );
    const password = randomBytes(32).toString("hex"),
      start = new Date(),
      expiry = new Date(start.getTime() + 86400000);
    const runtime = new URL(u.href);
    runtime.username = "docked_pack_acceptance." + c.projectRef;
    runtime.password = password;
    runtime.search = "";
    // Save before applying so an interrupted response never creates an unknown role.
    writeFileSync(
      secretFile,
      JSON.stringify(
        {
          projectRef: c.projectRef,
          databaseUrl: runtime.href,
          start: start.toISOString(),
          expiry: expiry.toISOString(),
          state: "prepared",
        },
        null,
        2,
      ),
    );
    const result = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(1611202601)`;
      assert.equal(
        (
          await tx`select 1 from pg_namespace where nspname=any(${manifest.schemas})`
        ).length,
        0,
        "Namespace exists: do not duplicate an operation",
      );
      assert.equal(
        (
          await tx`select 1 from pg_roles where rolname in('docked_pack_acceptance','docked_pack_acceptance_owner')`
        ).length,
        0,
        "Role exists: inspect first",
      );
      const before = await tx<
        PreviewNamespace[]
      >`select oid,nspname,nspowner,coalesce(nspacl::text,'') acl from pg_namespace order by oid`;
      await tx.unsafe(
        `create role docked_pack_acceptance login nosuperuser nocreatedb nocreaterole noinherit nobypassrls password '${password}' valid until '${expiry.toISOString()}'`,
      );
      for (const b of bytes) await tx.unsafe(b);
      await tx`update b1_acceptance.window set starts=${start},expires=${expiry} where id`;
      const after = await tx<
        PreviewNamespace[]
      >`select oid,nspname,nspowner,coalesce(nspacl::text,'') acl from pg_namespace order by oid`;
      const [temporary] = await tx`select pg_my_temp_schema() oid`;
      const namespaceVerification = verifyPreviewNamespaces(
        before,
        after,
        manifest.schemas,
        Number(temporary.oid),
      );
      const [counts] =
        await tx`select (select count(*)::int from b1_commercial_billing.definitions) definitions,(select count(*)::int from b1_beta_packs.issued) issued,(select count(*)::int from b1_acceptance.members) accounts`;
      assert.deepEqual(counts, {
        definitions: manifest.syntheticDefinitions,
        issued: 0,
        accounts: 2,
      });
      for (const schema of manifest.schemas) {
        assert(/^b1_[a-z_]+$/.test(schema));
        await tx.unsafe(
          `revoke create on schema ${schema} from docked_pack_acceptance_owner`,
        );
      }
      await tx.unsafe(
        "grant docked_pack_acceptance_owner to current_user with inherit false,set false",
      );
      return {
        counts,
        unchangedExistingSchemaAcl: true,
        namespaceVerification,
      };
    });
    writeFileSync(
      secretFile,
      JSON.stringify(
        {
          projectRef: c.projectRef,
          databaseUrl: runtime.href,
          start: start.toISOString(),
          expiry: expiry.toISOString(),
          state: "applied",
        },
        null,
        2,
      ),
    );
    writeFileSync(
      dir + "/preview-application.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          packageSha256: approval.packageSha256,
          projectRef: c.projectRef,
          ...result,
          productionWrites: 0,
          providerSettingsChanged: false,
          existingAccountsChanged: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        isolatedPreviewApplied: true,
        ...result,
        expiry: expiry.toISOString(),
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e: any) => {
  writeFileSync(
    priv + "/operator-error.private.txt",
    JSON.stringify(
      { message: e.message, code: e.code, where: e.where },
      null,
      2,
    ),
  );
  console.error(
    "Preview operator stopped; inspect private diagnostic and recorded state before retrying",
  );
  process.exitCode = 1;
});
