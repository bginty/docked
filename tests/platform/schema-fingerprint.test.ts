import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { v31SchemaFingerprintSql } from "../../scripts/lib/v31-schema-fingerprint";
test("schema fingerprint retains full qualified identities and distinguishes long constraint names", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema isolated_fingerprint;
   create table isolated_fingerprint.long_commercial_approval_boundary_table(value integer,
    constraint long_commercial_approval_boundary_table_first_check check(value>0),
    constraint long_commercial_approval_boundary_table_second_check check(value<100));`);
    const entries = v31SchemaFingerprintSql.slice(
      0,
      v31SchemaFingerprintSql.lastIndexOf("\nselect md5"),
    );
    const { rows } = await db.query<{ identity: string }>(
      entries +
        " select identity from entries where kind='constraint' and identity like 'isolated_fingerprint.%' order by identity",
    );
    assert.equal(rows.length, 2);
    assert(rows.every((r) => r.identity.length > 63));
    assert.equal(new Set(rows.map((r) => r.identity)).size, 2);
    const before = await db.query(v31SchemaFingerprintSql);
    assert.deepEqual(await db.query(v31SchemaFingerprintSql), before);
    await db.exec(`alter table isolated_fingerprint.long_commercial_approval_boundary_table drop constraint long_commercial_approval_boundary_table_second_check;
  alter table isolated_fingerprint.long_commercial_approval_boundary_table add constraint long_commercial_approval_boundary_table_second_check check(value<101);`);
    assert.notDeepEqual(
      (await db.query(v31SchemaFingerprintSql)).rows,
      before.rows,
    );
  } finally {
    await db.close();
  }
});
