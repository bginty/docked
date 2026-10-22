import "server-only";
import { z } from "zod";

const status = z.object({
  sport: z.enum(["epl", "nba", "afl", "nrl"]),
  provider: z.string().optional(),
  activation: z.string(),
  last_source_success: z.number().nullable(),
  last_delivery: z.number().nullable(),
  last_attempt: z.number().nullable().optional(),
  next_sync: z.number().nullable(),
  games_imported: z.number(),
  player_records: z.number(),
  missing_mappings: z.number(),
  invalid_records: z.number(),
  errors: z.number(),
  blocked_jobs: z.number(),
  changed_records: z.number(),
  last_error: z.string().nullable().optional(),
  scoring_publication: z.string(),
});
const envelope = z.object({
  schema_version: z.literal("1.1"),
  synthetic: z.boolean(),
  data: z.array(status).max(4),
});
export async function multisportFeedHealth() {
  const base = process.env.DOCKED_MULTI_FEED_ORIGIN;
  const token = process.env.DOCKED_MULTI_FEED_ADMIN_KEY;
  if (!base || !token) return { state: "disabled" as const };
  try {
    const origin = new URL(base);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/"
    )
      throw Error("Invalid bound origin");
    const response = await fetch(new URL("/admin/multisport/status", origin), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Unavailable");
    const body = await response.text();
    if (body.length > 65536) throw Error("Oversize");
    return { state: "connected" as const, ...envelope.parse(JSON.parse(body)) };
  } catch {
    return { state: "unavailable" as const };
  }
}
