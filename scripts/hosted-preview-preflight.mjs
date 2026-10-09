// Read-only, fixed-project catalog evidence. Never prints private connection data.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const root = fileURLToPath(new URL("../", import.meta.url));
const projectRef = "bckkllmndoxzpzdqrevb";
const organizationId = "ernfnkcbalhyqpsrzdwa";
let sql;
let stage = "identity";
try {
  const connection = JSON.parse(
    await readFile(
      path.join(root, "private-data/hosted-preview/connection.json"),
      "utf8",
    ),
  );
  if (
    connection.projectRef !== projectRef ||
    connection.organizationId !== organizationId ||
    new URL(connection.supabaseUrl).origin !==
      `https://${projectRef}.supabase.co`
  )
    throw new Error("Identity gate");
  const database = new URL(connection.databaseUrl);
  const direct = database.hostname === `db.${projectRef}.supabase.co`;
  const session =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${projectRef}` &&
    database.port === "5432";
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    (!direct && !session)
  )
    throw new Error("Endpoint gate");
  const source = await readFile(
    path.join(root, "docs/qa/hosted-preview/preflight.sql"),
    "utf8",
  );
  if (
    !source.includes("begin transaction read only;") ||
    !source.trimEnd().endsWith("rollback;")
  )
    throw new Error("Read-only artifact gate");
  if (process.argv.length > 2) throw new Error("Argument gate");
  const ca = await readFile(
    process.env.DATABASE_SSL_CA_FILE ??
      path.join(root, "certs/supabase-prod-ca-2021.crt"),
    "utf8",
  );
  sql = postgres(connection.databaseUrl, {
    host: database.hostname,
    port: Number(database.port || 5432),
    username: decodeURIComponent(database.username),
    database: decodeURIComponent(database.pathname.slice(1)),
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: true, ca },
    connect_timeout: 15,
    idle_timeout: 5,
  });
  stage = "read-only-query";
  const results = await sql.unsafe(source).simple();
  const sets = Array.isArray(results[0]) ? results : [results];
  const output = {
    projectRef,
    organizationId,
    capturedAt: new Date().toISOString(),
    evidence: "hosted-read-only-catalog",
    serverCertificateVerified: true,
    authAccountsOrSessionsSelected: false,
    resultSets: sets.map((rows, index) => ({ index, rows: Array.from(rows) })),
  };
  await writeFile(
    path.join(root, "docs/qa/hosted-preview/preflight-results.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    `Verified Docked Preview read-only catalog captured: ${sets.length} result sets. No Auth records or credentials emitted.`,
  );
} catch (error) {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : "UNAVAILABLE";
  console.error(
    `Hosted preflight failed at ${stage} (${code}). Verify fixed project identity, TLS connection and read-only SQL privately.`,
  );
  process.exitCode = 1;
} finally {
  if (sql) await sql.end({ timeout: 5 });
}
