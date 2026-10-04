import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { assertPhase5cConnection } from "./phase5c-scope";

async function main() {
  if (process.argv[2] !== "--confirm-project=bckkllmndoxzpzdqrevb")
    throw Error("Exact Docked Preview identity required");
  const c = JSON.parse(
    await readFile("private-data/hosted-preview/connection.json", "utf8"),
  );
  assertPhase5cConnection(c);
  const sql = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca: await readFile(c.caFile, "utf8") },
  });
  try {
    const events =
      await sql`select id,competition_id,participants,start_at,status,source_mappings from private.events where competition_id='soccer_epl' and status='scheduled' and start_at>clock_timestamp() order by start_at,id`;
    const receipt = {
      projectRef: c.projectRef,
      capturedAt: new Date().toISOString(),
      selectionRule: "earliest supported fixture; no market query",
      events,
    };
    await writeFile(
      "private-data/phase5d/canonical-fixtures.json",
      JSON.stringify(receipt, null, 2),
      { flag: "wx" },
    );
    console.log(JSON.stringify(receipt));
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Docked fixture inspection failed; credentials suppressed");
  process.exitCode = 1;
});
