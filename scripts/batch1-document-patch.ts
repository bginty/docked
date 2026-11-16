/** PostgreSQL round-trip oracle for compact history reconstruction; read-only. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { creditsDocumentPatch } from "../src/server/credits-document-patch";
import { batch1Database } from "./lib/batch1-isolated-db";

async function main() {
  const sql = batch1Database("postgres");
  const samples: unknown[] = [
    null,
    true,
    false,
    0,
    -2.75,
    "ü ' ; --",
    [],
    [null, { a: 1 }],
    {},
    { a: 1, nested: { keep: true, remove: "x" }, array: [1, 2] },
    {
      a: null,
      nested: { keep: false, added: [3] },
      array: [2, 1],
      missing: undefined,
    },
    JSON.parse(
      '{"__proto__":{"key":"value"},"constructor":{},"quoted\'key":3}',
    ),
    Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [String(i), { value: i }]),
    ),
  ];
  let checks = 0;
  try {
    for (const before of samples)
      for (const after of samples) {
        const expression = creditsDocumentPatch(
          sql,
          JSON.stringify(before),
          after,
        );
        const [result] =
          await sql`with source as materialized(select ${sql.json(before as never)}::jsonb document)
        select (${expression}) is not distinct from ${sql.json(after as never)}::jsonb identical from source`;
        assert.equal(result.identical, true, `Round-trip case ${checks}`);
        checks++;
      }
    const [{ document }] =
      await sql`select document from credits_sandbox.state where id`;
    const beforeJson = JSON.stringify(document);
    // Exercise in-place authorisation changes AFTER capturing the locked input.
    document.economy.players["synthetic-patch-oracle"] = {
      id: "not-a-real-player",
      status: "test",
    };
    document.requests["synthetic-patch-oracle"] = {
      result: { entitlement: "not-a-real-pack" },
    };
    document.events.push({
      test: "read-only JSON reconstruction, never persisted",
    });
    const expression = creditsDocumentPatch(sql, beforeJson, document);
    const [result] =
      await sql`with source as materialized(select document #> '{}'::text[] document from credits_sandbox.state where id)
      select (${expression}) is not distinct from ${sql.json(document)}::jsonb identical from source`;
    assert.equal(result.identical, true);
    const evidence = {
      at: new Date().toISOString(),
      passed: true,
      syntheticJsonCases: checks,
      fullRestoredDocumentAndPreAuthorisationMutation: true,
      productionWrites: 0,
      isolatedWrites: 0,
      scope:
        "Actual PostgreSQL reconstruction equals independently serialized complete expected JSON",
    };
    writeFileSync(
      "docs/qa/batch1-pack-phone-20261116/document-patch.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
