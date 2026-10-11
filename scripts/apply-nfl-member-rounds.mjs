import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
const file = process.argv.includes("--swaps")
  ? "20261011011400_nfl_swap_projection.sql"
  : process.argv.includes("--projection")
    ? "20261011004639_nfl_member_read_projection.sql"
    : "20261011002634_nfl_member_rounds.sql";
try {
  if (process.argv[2] !== "--apply") throw Error("Explicit apply required");
  const source = readFileSync("supabase/migrations/" + file, "utf8");
  const evidence = JSON.parse(
    readFileSync("docs/qa/nfl-member/migration-test.json", "utf8"),
  );
  if (
    !evidence.passed ||
    (process.argv.includes("--swaps")
      ? evidence.swapsSha256
      : process.argv.includes("--projection")
        ? evidence.projectionSha256
        : evidence.sha256) !== createHash("sha256").update(source).digest("hex")
  )
    throw Error("Exact tested migration required");
  await sql.begin(async (tx) => {
    const [old] =
      await tx`select statements from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
    if (old) {
      if (old.statements[0] !== source) throw Error("Migration mismatch");
      return;
    }
    await tx.unsafe(source);
    await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},'nfl_member_rounds',${[source]})`;
  });
  console.log(
    JSON.stringify({ projectRef, migration: file, admissionChanged: false }),
  );
} finally {
  await sql.end();
}
