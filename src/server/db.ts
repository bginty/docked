import "server-only";
import postgres from "postgres";
import { databaseConnectionOptions } from "./database-tls";
import { databasePoolOptions } from "./database-pool";
import { assertDeploymentEnvironment } from "@/core/deployment-environment";
import { rateLimitQuery } from "./rate-limit-query";
let connection: ReturnType<typeof postgres> | undefined;
export function db() {
  assertDeploymentEnvironment(process.env);
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  return (connection ??= postgres(process.env.DATABASE_URL, {
    ...databasePoolOptions(),
    ...databaseConnectionOptions(process.env.DATABASE_URL),
  }));
}
export async function rateLimit(key: string, limit = 20, seconds = 60) {
  const sql = db();
  const rows = await sql.unsafe(rateLimitQuery, [key, seconds]);
  return rows[0].count <= limit;
}
