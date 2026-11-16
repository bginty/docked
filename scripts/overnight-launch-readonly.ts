/** Post-Batch-1 observation only: READ ONLY transaction and provider GETs. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { checksumQuery, tableListQuery } from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  packet,
  source,
  sha,
  priv,
} from "./lib/batch1-production-execution.mjs";
import { persistedSnapshot } from "./lib/batch1-production-snapshot.mjs";

const root = process.cwd();
const out = "docs/qa/overnight-launch-20261117/production-readonly.json";
const p = packet();
const before = JSON.parse(
  readFileSync(priv + "/database-postflight.private.json", "utf8"),
);
const beta = JSON.parse(
  readFileSync(priv + "/beta-purchase-before.private.json", "utf8"),
);
const hash = (v: unknown) => sha(JSON.stringify(v));
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const evidence = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='60s'`;
        const schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        assert.deepEqual(schema, before.schema, "Schema, ACL or RLS drift");
        const roles =
          await tx`select rolname,rolsuper,rolinherit,rolcanlogin,rolreplication,rolbypassrls,rolcreaterole,rolcreatedb,rolconnlimit,rolvaliduntil,rolconfig from pg_roles where rolname!~'^pg_' order by rolname`;
        const memberships =
          await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by 1,2,3`;
        assert.deepEqual(persistedSnapshot(roles), before.roles);
        assert.deepEqual(persistedSnapshot(memberships), before.memberships);
        const versions = p.migrations.map((m: { file: string }) =>
          m.file.split("/").at(-1)!.slice(0, 14),
        );
        const ledger =
          await tx`select version,name,statements from supabase_migrations.schema_migrations where version=any(${versions}::text[]) order by version`;
        assert.equal(ledger.length, 3);
        const migrations = p.migrations.map(
          (m: { file: string; sha256: string }) => {
            const entry = ledger.find(
              (v) => v.version === m.file.split("/").at(-1)!.slice(0, 14),
            );
            assert(entry && entry.statements.length === 1);
            assert.equal(sha(entry.statements[0]), m.sha256);
            return { file: m.file, sha256: m.sha256, ledgerMatches: true };
          },
        );
        const names = (await tx.unsafe(tableListQuery))[0].value as string[];
        assert.deepEqual(names, Object.keys(before.tables));
        const changedTables: {
          table: string;
          beforeCount: number;
          afterCount: number;
        }[] = [];
        for (let i = 0; i < names.length; i += 25) {
          const rows = await tx.unsafe(
            names
              .slice(i, i + 25)
              .map(checksumQuery)
              .join(" union all "),
          );
          for (const { value: v } of rows) {
            if (
              v.hash !== before.tables[v.table].hash ||
              v.count !== before.tables[v.table].count
            )
              changedTables.push({
                table: v.table,
                beforeCount: before.tables[v.table].count,
                afterCount: v.count,
              });
          }
        }
        const [state] =
          await tx`select document,revision from credits_sandbox.state where id`;
        const betaWalletUnchanged =
          hash(state.document) === hash(beta.document);
        const assetChangedTables = changedTables.filter((v) =>
          /^(credits_sandbox|commercial_billing|beta_packs|card_collection|card_custody)\./.test(
            v.table,
          ),
        );
        return {
          at: new Date().toISOString(),
          schema,
          migrations,
          roleMembershipsUnchanged: true,
          protectedTablesCompared: names.length,
          changedTables,
          assetChangedTables,
          betaReview: {
            beforeAt: beta.at,
            beforeRevision: beta.revision,
            currentRevision: state.revision,
            fullWalletUnchanged: betaWalletUnchanged,
            submittedPurchaseObserved: !betaWalletUnchanged
              ? "Requires receipt-delta investigation"
              : false,
          },
          securityDigest: hash([
            persistedSnapshot(roles),
            persistedSnapshot(memberships),
          ]),
        };
      },
    );
    const token = JSON.parse(
      readFileSync(
        "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
        "utf8",
      ),
    ).token;
    const get = async (route: string) => {
      const r = await fetch(
        "https://api.vercel.com" +
          route +
          (route.includes("?") ? "&" : "?") +
          "teamId=" +
          p.teamId,
        {
          headers: { Authorization: "Bearer " + token },
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        },
      );
      assert(r.ok, "Vercel GET failed: " + r.status);
      return r.json();
    };
    const [deployment, env, release] = await Promise.all([
      get("/v13/deployments/docked.com.au"),
      get("/v9/projects/" + p.projectId + "/env"),
      fetch("https://docked.com.au/api/beta-release", {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }).then((r) => {
        assert(r.ok);
        return r.json();
      }),
    ]);
    assert.equal(deployment.id, "dpl_Fnb75vUFUaDd4WL6pnkQDttKoQoh");
    assert.equal(deployment.meta.githubCommitSha, source);
    assert.equal(release.commit, source);
    assert.equal(release.deploymentId, deployment.id);
    assert.equal(release.publicRegistration, false);
    const original = JSON.parse(
      readFileSync(priv + "/project-env.private.json", "utf8"),
    );
    const metadata = (rows: Record<string, unknown>[]) =>
      rows
        .filter((e) => (e.target as string[]).includes("production"))
        .map(
          ({
            id,
            key,
            type,
            target,
            createdAt,
            updatedAt,
            configurationId,
            gitBranch,
          }) => ({
            id,
            key,
            type,
            target,
            createdAt,
            updatedAt,
            configurationId,
            gitBranch,
          }),
        )
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    assert.deepEqual(metadata(env.envs), metadata(original.envs));
    const report = {
      ...evidence,
      release,
      deployment: {
        id: deployment.id,
        readyState: deployment.readyState,
        nodeVersion: deployment.nodeVersion,
        source: deployment.meta.githubCommitSha,
      },
      runtimeBindings: {
        count: metadata(env.envs).length,
        metadataUnchanged: true,
        secretValuesRead: false,
        limitation:
          "Write-only values not independently read back; immutable deployment and binding identities preserved.",
      },
      productionWrites: 0,
      previewWrites: 0,
      smsAttempts: 0,
      purchases: 0,
    };
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(
    e instanceof assert.AssertionError
      ? "Read-only assertion failed: " + e.message.split("\n")[0]
      : "Read-only overnight assessment failed; no mutations performed.",
  );
  process.exitCode = 1;
});
