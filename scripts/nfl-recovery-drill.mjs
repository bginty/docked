// Offline recovery drill. Never connects to, or writes, a hosted database.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
const dir = process.argv[2] ?? "private-data/nfl-live-recovery-20261017";
const read = async (name) =>
  JSON.parse(await readFile(`${dir}/${name}`, "utf8"));
const raw = await readFile(`${dir}/snapshot.json`);
const receipt = await read("receipt.json");
assert.equal(createHash("sha256").update(raw).digest("hex"), receipt.sha256);
const tables = { ...JSON.parse(raw), ...(await read("dependencies.json")) };
const userIds = tables["auth.user_ids"];
delete tables["auth.user_ids"];
const catalog = await read("catalog.json");
const functions = await read("functions.json");
assert.ok(
  functions.some(
    (f) =>
      f.schema_name === "credits_sandbox" &&
      f.proname === "guard_economy_state",
  ),
);
const q = (x) => '"' + x.replaceAll('"', '""') + '"';
const qualified = (name) => name.split(".").map(q).join(".");
const pg = new PGlite();
const result = {
  snapshotSha256: receipt.sha256,
  tables: {},
  primaryUniqueConstraints: 0,
  foreignKeys: 0,
  externalForeignKeys: [],
  limitations: [
    "Not a full cluster/Auth restore. Auth IDs are dependency stubs only.",
    "Raw source revisions remain external dependencies; their bodies are not in this scoped backup.",
    "This drill validates typed rows and references, not automatic production rollback or all triggers.",
  ],
};
try {
  await pg.exec(
    "set timezone='UTC';create schema auth;create table auth.users(id uuid primary key);",
  );
  for (const id of userIds)
    await pg.query("insert into auth.users values($1)", [id]);
  for (const schema of new Set(Object.keys(tables).map((n) => n.split(".")[0])))
    await pg.exec(`create schema ${q(schema)}`);
  for (const [name, rows] of Object.entries(tables)) {
    const [schema, table] = name.split(".");
    const cols = catalog.columns
      .filter((c) => c.table_schema === schema && c.table_name === table)
      .sort((a, b) => a.ordinal_position - b.ordinal_position);
    assert.ok(cols.length, `Missing columns: ${name}`);
    const type = (c) => {
      assert.equal(c.udt_schema, "pg_catalog");
      return c.udt_name.startsWith("_")
        ? q(c.udt_name.slice(1)) + "[]"
        : q(c.udt_name);
    };
    await pg.exec(
      `create table ${qualified(name)}(${cols.map((c) => `${q(c.column_name)} ${type(c)}${c.is_nullable === "NO" ? " not null" : ""}`).join(",")})`,
    );
    await pg.query(
      `insert into ${qualified(name)} select * from jsonb_populate_recordset(null::${qualified(name)}, $1::jsonb)`,
      [JSON.stringify(rows)],
    );
    const check = await pg.query(
      `select not exists((select to_jsonb(t) from ${qualified(name)} t except all select value from jsonb_array_elements($1::jsonb)) union all (select value from jsonb_array_elements($1::jsonb) except all select to_jsonb(t) from ${qualified(name)} t)) identical`,
      [JSON.stringify(rows)],
    );
    assert.equal(
      check.rows[0].identical,
      true,
      `Typed restore mismatch: ${name}`,
    );
    result.tables[name] = rows.length;
  }
  for (const c of catalog.constraints.filter(
    (c) =>
      /^(PRIMARY KEY|UNIQUE)/.test(c.definition) &&
      tables[`${c.schema}.${c.table}`],
  )) {
    await pg.exec(
      `alter table ${qualified(c.schema + "." + c.table)} add constraint ${q(c.name)} ${c.definition}`,
    );
    result.primaryUniqueConstraints++;
  }
  for (const c of catalog.constraints.filter(
    (c) =>
      c.definition.startsWith("FOREIGN KEY") &&
      tables[`${c.schema}.${c.table}`],
  )) {
    const referenced = c.definition.match(/REFERENCES ([a-z_]+\.[a-z_]+)/)?.[1];
    if (referenced !== "auth.users" && !tables[referenced]) {
      result.externalForeignKeys.push({
        table: c.schema + "." + c.table,
        name: c.name,
        referenced,
      });
      continue;
    }
    await pg.exec(
      `alter table ${qualified(c.schema + "." + c.table)} add constraint ${q(c.name)} ${c.definition}`,
    );
    result.foreignKeys++;
  }
  result.passed = true;
  result.at = new Date().toISOString();
  await writeFile(`${dir}/restore-drill.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      passed: true,
      tables: Object.keys(result.tables).length,
      rows: Object.values(result.tables).reduce((a, b) => a + b, 0),
      primaryUniqueConstraints: result.primaryUniqueConstraints,
      foreignKeys: result.foreignKeys,
      externalForeignKeys: result.externalForeignKeys.length,
    }),
  );
} finally {
  await pg.close();
}
