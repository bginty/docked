import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { databaseConnectionOptions } from "../../src/server/database-tls";

let sql: ReturnType<typeof postgres> | undefined;
async function main() {
  try {
    const connection = JSON.parse(
      readFileSync("private-data/hosted-preview/connection.json", "utf8"),
    );
    const url = new URL(connection.databaseUrl);
    if (
      connection.projectRef !== "bckkllmndoxzpzdqrevb" ||
      connection.organizationId !== "ernfnkcbalhyqpsrzdwa" ||
      url.hostname !== "aws-0-ap-southeast-2.pooler.supabase.com" ||
      url.port !== "5432" ||
      decodeURIComponent(url.username) !== "postgres.bckkllmndoxzpzdqrevb"
    )
      throw new Error("Identity gate");
    sql = postgres(connection.databaseUrl, {
      ...databaseConnectionOptions(connection.databaseUrl, {
        DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
      }),
      max: 1,
      prepare: false,
      connect_timeout: 15,
    });
    const result = await sql.begin("read only", (tx) =>
      tx.unsafe(
        "select ssl,version as tls_version from pg_stat_ssl where pid=pg_backend_pid()",
      ),
    );
    if (result.length !== 1 || result[0].ssl !== true)
      throw new Error("TLS metadata gate");
    writeFileSync(
      "docs/qa/hosted-preview/shared-tls-helper-proof.json",
      JSON.stringify(
        {
          projectRef: connection.projectRef,
          capturedAt: new Date().toISOString(),
          helper: "src/server/database-tls.ts",
          serverCertificateVerified: true,
          hostnameVerified: true,
          readOnly: true,
          tls: result[0],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Shared application TLS helper: verified certificate/hostname and actual read-only query PASS.",
    );
  } catch {
    console.error(
      "Shared TLS helper proof failed; no private details emitted.",
    );
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
void main();
