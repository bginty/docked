// Read-only, exact-target application snapshot. Not a full Auth/storage disaster-recovery backup.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../src/server/db";
const directory = pathToFileURL(resolve("private-data/hosted-preview") + sep);
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    const connection = JSON.parse(
      await readFile(new URL("connection.json", directory), "utf8"),
    );
    if (
      process.argv[2] !== "--snapshot-phase4" ||
      connection.projectRef !== "bckkllmndoxzpzdqrevb" ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      process.env.DATABASE_URL !== connection.databaseUrl ||
      process.env.APP_ENV !== "preview" ||
      process.env.SUPABASE_ENV !== "preview"
    )
      throw Error("Snapshot scope denied");
    sql = db();
    const snapshot = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const migrations =
          await tx`select version,name from supabase_migrations.schema_migrations order by version`;
        if (migrations.length !== 6)
          throw Error("Expected six-migration preimage");
        const tables =
          await tx`select schemaname,tablename from pg_tables where schemaname in ('public','private','preview_auth') order by 1,2`;
        const data: Record<string, unknown> = {};
        for (const table of tables)
          data[`${table.schemaname}.${table.tablename}`] =
            await tx`select * from ${tx(table.schemaname)}.${tx(table.tablename)}`;
        const functions =
          await tx`select n.nspname,p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','preview_auth') and p.prokind in ('f','p') order by 1,2`;
        const constraints =
          await tx`select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','preview_auth') order by 1,2,3`;
        const triggers =
          await tx`select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private','preview_auth') order by 1,2,3`;
        const policies =
          await tx`select * from pg_policies where schemaname in ('public','private','preview_auth') order by schemaname,tablename,policyname`;
        return { migrations, data, functions, constraints, triggers, policies };
      },
    );
    const migrationHashes: Record<string, string> = {};
    for (const name of await readdir("supabase/migrations")) {
      if (name.endsWith(".sql"))
        migrationHashes[name] = createHash("sha256")
          .update(await readFile(`supabase/migrations/${name}`))
          .digest("hex");
    }
    const recordedAt = new Date().toISOString();
    const payload = JSON.stringify({
      projectRef: connection.projectRef,
      recordedAt,
      migrationHashes,
      ...snapshot,
    });
    await writeFile(
      new URL("phase4-before-migration.json", directory),
      payload,
      {
        mode: 0o600,
        flag: "wx",
      },
    );
    await writeFile(
      "docs/qa/phase4/migration-preimage.json",
      JSON.stringify(
        {
          projectRef: connection.projectRef,
          recordedAt,
          migrationCount: snapshot.migrations.length,
          applicationTables: Object.keys(snapshot.data).length,
          sha256: createHash("sha256").update(payload).digest("hex"),
          migrationHashes,
          scope:
            "Private application rows, function/constraint/trigger/policy preimages and versioned migrations. Auth-managed records and storage excluded. No disaster restore certification; hosted migration is transactional and recovery uses forward repair.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Six-migration application preimage saved privately; hash receipt contains no account data.",
    );
  } catch (error) {
    await writeFile(
      new URL("last-snapshot-error.json", directory),
      JSON.stringify({
        message: error instanceof Error ? error.message : "Unknown",
        code: (error as { code?: string }).code,
      }),
      { mode: 0o600 },
    );
    console.error(
      "Application snapshot failed; do not apply migration until investigated. No private data printed.",
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
