// Read-only, exact Docked beta identity. No Auth rows, grants or jobs are changed.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls.ts";
const out = "docs/qa/fantasy-cleanup";
mkdirSync(out, { recursive: true });
const after = process.argv.includes("--after");
const r = await fetch("https://docked.com.au", {
  redirect: "error",
  signal: AbortSignal.timeout(25000),
});
const body = await r.text();
assert.equal(r.status, 200);
const holding = {
  at: new Date().toISOString(),
  status: r.status,
  sha256: createHash("sha256").update(body).digest("hex"),
};
if (after) {
  const before = JSON.parse(readFileSync(out + "/holding-before.json"));
  holding.unchanged = before.sha256 === holding.sha256;
  assert.ok(holding.unchanged);
}
writeFileSync(
  out + `/holding-${after ? "after" : "before"}.json`,
  JSON.stringify(holding, null, 2) + "\n",
);
if (!after) {
  const c = JSON.parse(
    readFileSync(
      "private-data/production/beta-runtime-connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(c.databaseRole, "docked_beta_app");
  assert.equal(
    new URL(c.supabaseUrl).origin,
    "https://pojoymtniryarxxunyvz.supabase.co",
  );
  const u = new URL(c.databaseUrl);
  assert.ok(
    (u.hostname === "db.pojoymtniryarxxunyvz.supabase.co" ||
      u.hostname.endsWith(".pooler.supabase.com")) &&
      decodeURIComponent(u.username).includes("docked_beta_app"),
  );
  const sql = postgres(
    c.databaseUrl,
    databaseConnectionOptions(c.databaseUrl, {
      APP_ENV: "production",
      DATABASE_URL: c.databaseUrl,
      DATABASE_CONNECTION_MODE: "session",
      DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
    }),
  );
  try {
    const report = await sql.begin("read only", async (tx) => {
      const role = (
        await tx`select current_user as name,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user`
      )[0];
      assert.equal(role.name, "docked_beta_app");
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      const routines =
        await tx`select n.nspname as schema,p.proname as name,has_function_privilege(current_user,p.oid,'EXECUTE') as executable from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','fantasy','beta_private','beta_fantasy') and p.proname ~ '(odds|edge|publication|prediction|research|settle)' order by 1,2`;
      const cron =
        await tx`select exists(select 1 from pg_extension where extname='pg_cron') as installed`;
      return {
        at: new Date().toISOString(),
        projectRef: c.projectRef,
        scope:
          "Restricted beta role, catalog-only READ ONLY transaction. Not a full service-role or scheduler audit.",
        role,
        retainedLegacyRoutines: routines,
        cronInstalled: cron[0].installed,
        jobInspection:
          "Not performed: restricted role cannot establish all scheduler ownership. Separate retirement review required.",
      };
    });
    writeFileSync(
      out + "/hosted-database-readiness.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        holdingStatus: holding.status,
        databaseRole: report.role.name,
        retainedRoutines: report.retainedLegacyRoutines.length,
      }),
    );
  } catch {
    throw Error("Read-only Docked beta catalog check failed; no data changed.");
  } finally {
    await sql.end({ timeout: 5 });
  }
} else console.log(JSON.stringify({ holdingUnchanged: holding.unchanged }));
