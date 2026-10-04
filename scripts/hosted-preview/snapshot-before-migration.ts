// Read-only, exact-target application snapshot. Not a full Auth/storage disaster-recovery backup.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../src/server/db";
const directory = pathToFileURL(resolve("private-data/hosted-preview") + sep);
const modes = {
  "--snapshot-phase5c": {
    count: 16,
    privateFile: "phase5c-before-migration.json",
    receipt: "docs/qa/phase5c/migration-preimage.json",
  },
  "--snapshot-phase5b": {
    count: 15,
    privateFile: "phase5b-before-migration.json",
    receipt: "docs/qa/phase5b/migration-preimage.json",
  },
  "--snapshot-phase5a-driver-repair": {
    count: 14,
    privateFile: "phase5a-before-driver-repair.json",
    receipt: "docs/qa/phase5a/driver-repair-preimage.json",
  },
  "--snapshot-phase5a": {
    count: 12,
    privateFile: "phase5a-before-migration.json",
    receipt: "docs/qa/phase5a/migration-preimage.json",
  },
  "--snapshot-phase4": {
    count: 6,
    privateFile: "phase4-before-migration.json",
    receipt: "docs/qa/phase4/migration-preimage.json",
  },
  "--snapshot-android-preview": {
    count: 7,
    privateFile: "android-preview-before-migration.json",
    receipt: "docs/qa/android-https-preview/migration-preimage.json",
  },
  "--snapshot-session-hardening": {
    count: 8,
    privateFile: "android-session-before-migration.json",
    receipt: "docs/qa/android-https-preview/session-migration-preimage.json",
  },
  "--snapshot-phase5": {
    count: 11,
    privateFile: "phase5-before-migration.json",
    receipt: "docs/qa/phase5/migration-preimage.json",
  },
} as const;
async function main() {
  let sql: ReturnType<typeof db> | undefined;
  try {
    const connection = JSON.parse(
      await readFile(new URL("connection.json", directory), "utf8"),
    );
    const mode = modes[process.argv[2] as keyof typeof modes];
    if (
      !mode ||
      process.argv.length !== 3 ||
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
        if (migrations.length !== mode.count)
          throw Error("Unexpected migration preimage count");
        const state = (
          await tx`select
          (select count(*)::int from auth.users) as auth_users,
          (select count(*)::int from auth.sessions) as sessions,
          (select count(*)::int from public.profiles) as profiles,
          (select count(*)::int from private.region_policies where approved) as approved_policies,
          (select count(*)::int from private.feature_flags where enabled) as enabled_flags`
        )[0];
        if (
          [7, 8].includes(mode.count) &&
          (migrations.at(-1)?.version !==
            (mode.count === 7 ? "20261003030722" : "20261003061548") ||
            Object.values(state).some((value) => value !== 0))
        )
          throw Error(
            "Android preview requires the verified closed empty-account seven-migration state",
          );
        if (
          mode.count === 11 ||
          mode.count === 12 ||
          mode.count === 14 ||
          mode.count === 15
        ) {
          if (
            migrations.at(-1)?.version !==
            (mode.count === 15
              ? "20261003232606"
              : mode.count === 14
                ? "20261003225203"
                : mode.count === 12
                  ? "20261003143903"
                  : "20261003121502")
          )
            throw Error(
              "Phase 5 requires the exact reviewed migration preimage",
            );
          const [guard] = await tx`select
            (select count(*)::int from private.feature_flags where key in ('publication','sending','forward_paper') and enabled) active_gates,
            (select count(*)::int from private.tip_publications) official_records`;
          if (guard.active_gates !== 0 || guard.official_records !== 0)
            throw Error("Phase 5 closed publication preimage changed");
          // Real invited accounts and labelled demo community content are preserved.
          // An empty-account assumption from the early Android setup is inapplicable.
        }
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
        const columns =
          await tx`select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,column_default,is_nullable from information_schema.columns where table_schema in ('public','private','preview_auth') order by 1,2,4`;
        const indexes =
          await tx`select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','private','preview_auth') order by 1,2,3`;
        const grants =
          await tx`select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','preview_auth') and c.relkind in ('r','v','m','S') order by 1,2`;
        const schemaGrants =
          await tx`select nspname,nspacl::text from pg_namespace where nspname in ('public','private','preview_auth') order by 1`;
        return {
          migrations,
          state,
          data,
          functions,
          constraints,
          triggers,
          policies,
          columns,
          indexes,
          grants,
          schemaGrants,
        };
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
    await writeFile(new URL(mode.privateFile, directory), payload, {
      mode: 0o600,
      flag: "wx",
    });
    await mkdir(resolve(mode.receipt, ".."), { recursive: true });
    await writeFile(
      mode.receipt,
      JSON.stringify(
        {
          projectRef: connection.projectRef,
          recordedAt,
          migrationCount: snapshot.migrations.length,
          state: snapshot.state,
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
      "Application preimage saved privately; hash receipt contains only counts and catalog hashes, no account data.",
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
