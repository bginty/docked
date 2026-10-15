// Exact missing chain, first rehearsed against schema-only restoration. No QA rows.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
const hosted = process.argv[2] === "--apply-reviewed-preview";
assert.ok(hosted || process.argv[2] === "--rehearse");
const evidence = "docs/qa/private-preview-release/";
const prior = JSON.parse(
  await readFile("docs/qa/social-visual-preview/preview-schema.json", "utf8"),
);
assert.equal(prior.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(prior.migrations.length, 19);
assert.equal(prior.missing.length, 41);
const scripts = await Promise.all(
  prior.missing.map(async (file) => {
    assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
    const sql = await readFile("supabase/migrations/" + file, "utf8");
    return {
      file,
      sql,
      sha256: createHash("sha256").update(sql).digest("hex"),
    };
  }),
);
let url, ssl;
if (hosted) {
  const rehearsal = JSON.parse(
    await readFile(evidence + "migration-rehearsal.json", "utf8"),
  );
  assert.equal(rehearsal.passed, true);
  assert.deepEqual(
    rehearsal.migrations,
    scripts.map(({ file, sha256 }) => ({ file, sha256 })),
  );
  const backup = JSON.parse(await readFile(evidence + "backup.json", "utf8"));
  assert.equal(backup.archiveReadable, true);
  assert.equal(
    backup.sha256,
    createHash("sha256")
      .update(
        await readFile(
          "private-data/private-preview-release/before-migrations.dump",
        ),
      )
      .digest("hex"),
  );
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assert.equal(c.projectRef, prior.projectRef);
  url = new URL(c.databaseUrl);
  assert.ok(
    url.hostname === `db.${prior.projectRef}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(url.username) === `postgres.${prior.projectRef}`),
  );
  ssl = {
    rejectUnauthorized: true,
    ca: await readFile("certs/supabase-prod-ca-2021.crt", "utf8"),
  };
} else {
  const c = JSON.parse(
    await readFile(
      "private-data/private-preview-release/rehearsal-connection.json",
      "utf8",
    ),
  );
  url = new URL(c.databaseUrl);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55422");
  url.pathname = "/docked_preview_restored";
  ssl = false;
}
const db = postgres(url.href, {
  max: 1,
  prepare: false,
  ssl,
  connect_timeout: 20,
  onnotice: () => {},
});
let stage = "preflight";
try {
  const before =
    await db`select version from supabase_migrations.schema_migrations order by version`;
  if (hosted)
    assert.deepEqual(
      before.map((x) => x.version),
      prior.migrations.map((x) => x.version),
    );
  else {
    assert.equal(before.length, 0);
    assert.equal((await db`select count(*)::int n from auth.users`)[0].n, 0);
  }
  const result = await db.begin(async (tx) => {
    await tx`set local lock_timeout='10s'`;
    await tx`set local statement_timeout='90s'`;
    for (const s of scripts) {
      stage = s.file;
      await tx.unsafe(s.sql);
      const version = s.file.split("_")[0],
        name = s.file.slice(15, -4);
      await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${version},${name},${[s.sql]})`;
    }
    stage = "postconditions";
    const [gate] = await tx`select enabled from beta_private.admission_control`;
    assert.equal(gate.enabled, false);
    assert.equal(
      (await tx`select count(*)::int n from beta_private.admissions`)[0].n,
      0,
    );
    assert.equal(
      (await tx`select count(*)::int n from credits_sandbox.state`)[0].n,
      0,
    );
    const [role] =
      await tx`select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname='docked_beta_app'`;
    assert.ok(role && Object.values(role).every((v) => v === false));
    return {
      admissionEnabled: false,
      admissions: 0,
      creditStates: 0,
      restrictedRole: true,
    };
  });
  const report = {
    passed: true,
    at: new Date().toISOString(),
    hosted,
    projectRef: hosted ? prior.projectRef : null,
    applied: scripts.length,
    migrations: scripts.map(({ file, sha256 }) => ({ file, sha256 })),
    ...result,
  };
  await writeFile(
    evidence + (hosted ? "migration-applied.json" : "migration-rehearsal.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ ...report, migrations: undefined }));
} catch (e) {
  console.error(
    JSON.stringify({
      passed: false,
      stage,
      code: e.code ?? e.name,
      message: hosted
        ? "Transaction rolled back; no activation"
        : String(e.message).slice(0, 300),
    }),
  );
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}
