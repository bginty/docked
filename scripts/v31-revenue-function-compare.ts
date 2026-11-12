/** Read-only hosted function comparison; schema metadata only. */
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
const query =
  "select jsonb_build_object('definition',pg_get_functiondef('commercial_billing.member_record(text)'::regprocedure),'acl',(select proacl from pg_proc where oid='commercial_billing.member_record(text)'::regprocedure)) value";
async function main() {
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const db = ownerDatabase();
  process.chdir(root);
  try {
    const [{ value: hosted }] = await db.begin("read only", async (tx) =>
      tx.unsafe(query),
    );
    const localQuery = async (text: string) =>
      new Promise<string>((resolve, reject) => {
        const p = spawn(
          "docker",
          [
            "exec",
            "-i",
            "docked-commercial-restore-20261112d-attempt-2",
            "psql",
            "-X",
            "-q",
            "-h",
            "/restore",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
          ],
          { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
        );
        let out = "",
          error = "";
        p.stdout.on("data", (c) => (out += c));
        p.stderr.on("data", (c) => (error += c));
        p.on("error", reject);
        p.on("exit", (code) =>
          code === 0 ? resolve(out) : reject(Error(error)),
        );
        p.stdin.end(text);
      });
    const output = await localQuery(query);
    const local = JSON.parse(output);
    const oldRollback = readFileSync(
      "docs/qa/v31-revenue-launch-20261113/collection-rollback.sql",
      "utf8",
    );
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    writeFileSync(
      "private-data/v31-revenue-launch-20261113/original-function.private.json",
      JSON.stringify({ hosted, local }),
    );
    const entryQuery =
      v31SchemaFingerprintSql.slice(
        0,
        v31SchemaFingerprintSql.lastIndexOf("\nselect md5"),
      ) +
      "\nselect coalesce(jsonb_agg(jsonb_build_object('kind',kind,'identity',identity,'definition',definition) order by kind,identity),'[]') value from entries where identity like 'commercial_billing%'";
    const [{ value: hostedEntries }] = await db.begin("read only", async (tx) =>
      tx.unsafe(entryQuery),
    );
    const localEntries = JSON.parse(await localQuery(entryQuery));
    const map = (rows: any[]) =>
      Object.fromEntries(
        rows.map((r) => [r.kind + ":" + r.identity, r.definition]),
      );
    const a = map(hostedEntries),
      b = map(localEntries);
    const differences = Object.keys({ ...a, ...b })
      .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      .map((identity) => ({
        identity,
        hosted: a[identity],
        local: b[identity],
      }));
    writeFileSync(
      "private-data/v31-revenue-launch-20261113/commercial-schema-differences.private.json",
      JSON.stringify(differences),
    );
    console.log(
      JSON.stringify({
        comparison:
          "hosted-current vs restored rollback, commercial schema only",
        differentObjects: differences.map((d) => d.identity),
      }),
    );
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        productionWrites: 0,
        hostedSha: sha(hosted.definition),
        localSha: sha(local.definition),
        sameDefinition: hosted.definition === local.definition,
        sameNormalised:
          hosted.definition.replaceAll("\r\n", "\n") ===
          local.definition.replaceAll("\r\n", "\n"),
        sameAcl: JSON.stringify(hosted.acl) === JSON.stringify(local.acl),
        hostedCr: (hosted.definition.match(/\r/g) || []).length,
        localCr: (local.definition.match(/\r/g) || []).length,
        rollbackCr: (oldRollback.match(/\r/g) || []).length,
      }),
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    "Read-only function comparison failed; no Production mutation attempted.",
  );
  process.exitCode = 1;
});
