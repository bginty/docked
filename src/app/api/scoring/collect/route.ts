import { createHash, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { databaseConnectionOptions } from "@/server/database-tls";
import { runNflCollection } from "@/server/nfl-collection-worker";
import manifest from "../../../../../config/hosted-production.json";

// Season-wide parsing/reconciliation belongs in the existing Node runtime.
// Opt-in replacement for the CPU-limited Edge collector; never a member action.
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const token = process.env.DOCKED_NFL_WORKER_TOKEN;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (
    !token ||
    !timingSafeEqual(
      hash(token),
      hash(request.headers.get("x-docked-worker") ?? ""),
    )
  )
    return new Response("Denied", { status: 403 });
  if (
    process.env.DOCKED_NFL_NODE_WORKER_ENABLED !== "true" ||
    process.env.VERCEL_ENV !== "production"
  )
    return new Response("Collector not activated", { status: 503 });
  const task = new URL(request.url).searchParams.get("task");
  if (
    task !== "weekly" &&
    task !== "pbp" &&
    task !== "rosters" &&
    task !== "reconcile"
  )
    return new Response("Invalid task", { status: 400 });
  const raw = process.env.DOCKED_NFL_WORKER_DATABASE_URL;
  if (!raw) return new Response("Collector not configured", { status: 503 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Collector not configured", { status: 503 });
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.username !== `docked_nfl_worker.${manifest.supabaseProjectRef}` ||
    !/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(target.hostname) ||
    target.pathname !== "/postgres"
  )
    return new Response("Collector target rejected", { status: 503 });
  const sql = postgres(raw, {
    ...databaseConnectionOptions(raw),
    max: 2,
    prepare: false,
    connect_timeout: 15,
    onnotice: () => {},
  });
  try {
    const [role] =
      await sql`select current_user name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
    if (role.name !== "docked_nfl_worker" || role.rolsuper || role.rolbypassrls)
      throw Error("Restricted worker required");
    return Response.json(await runNflCollection(sql, task, 2026));
  } catch {
    return Response.json(
      { status: "failed", message: "Inspect private collector diagnostics" },
      { status: 503 },
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
