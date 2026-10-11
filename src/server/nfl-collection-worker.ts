import type { Sql } from "postgres";
import {
  downloadNflDataset,
  nflResource,
  retainedNflSource,
} from "./nflverse-bundle";
import { connectLockedNflEntries } from "./nfl-member-rounds";
import { reconcileNflBundle } from "./nfl-postgame-reconcile";
import permit from "../../config/nfl-postgame-permit.json";
import type { PostgameMapping } from "../core/postgame-nflverse";

export async function runNflCollection(
  sql: Sql,
  task: "weekly" | "pbp" | "rosters" | "reconcile",
  season = 2026,
) {
  const [run] =
    await sql`insert into sports_feed.nfl_worker_runs default values returning id`;
  try {
    let detail: Record<string, unknown>;
    if (task !== "reconcile") {
      detail = await downloadNflDataset(sql, permit, task, season);
      if (task === "rosters") {
        const [cache] =
          await sql`select raw_id from sports_feed.postgame_cache where resource=${nflResource("rosters", season)}`;
        const raw = await retainedNflSource(
          sql,
          Number(cache.raw_id),
          "rosters",
          season,
        );
        // No issuance from scheduled jobs. Only refresh known player eligibility.
        await sql`select sports_feed.nfl_refresh_status(${sql.json(raw.body.rows)},${Number(raw.id)},${raw.checked_at})`;
      }
    } else {
      await sql`select sports_feed.nfl_lock_due()`;
      const [round] =
        await sql`update sports_feed.nfl_rounds set lease_until=clock_timestamp()+interval '3 minutes'
        where competition_id=(select competition_id from sports_feed.nfl_rounds where purpose='member' and locked_at is not null and next_check<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp()) order by next_check for update skip locked limit 1) returning *`;
      if (!round) detail = { status: "idle" };
      else {
        const issues: string[] = [];
        try {
          await connectLockedNflEntries(sql, round.stream_id);
          const [weekly] =
            await sql`select raw_id from sports_feed.postgame_cache where resource=${nflResource("weekly", season)}`;
          const [pbp] =
            await sql`select raw_id from sports_feed.postgame_cache where resource=${nflResource("pbp", season)}`;
          if (!weekly?.raw_id || !pbp?.raw_id)
            throw Error("Source not available");
          for (const mapping of round.fixtures as PostgameMapping[]) {
            const [complete] =
              await sql`select first_observed_at from sports_feed.completions where game_id=${mapping.gameId}`;
            if (
              !complete ||
              Date.now() <
                new Date(complete.first_observed_at).getTime() + 6 * 3600000
            ) {
              issues.push(
                `${mapping.gameId}: awaiting completion or six-hour collection delay`,
              );
              continue;
            }
            try {
              const out = await reconcileNflBundle(
                sql,
                round.stream_id,
                Number(weekly.raw_id),
                Number(pbp.raw_id),
                mapping,
                permit,
                { id: "scheduled-nfl-postgame", role: "importer" },
              );
              issues.push(...out.issues.map((s) => `${mapping.gameId}: ${s}`));
            } catch {
              issues.push(
                `${mapping.gameId}: source conflict, stale data or reviewer correction required`,
              );
            }
          }
        } catch {
          issues.push(
            "Collection unavailable; retained provisional results unchanged",
          );
        }
        await sql`update sports_feed.nfl_rounds set last_checked=clock_timestamp(),next_check=clock_timestamp()+interval '6 hours',lease_until=null,issues=${sql.json(issues)} where competition_id=${round.competition_id}`;
        detail = {
          status: issues.length ? "pending-review" : "reconciled",
          competition: round.competition_id,
          issues,
        };
      }
    }
    detail = { ...detail, task, season };
    await sql`update sports_feed.nfl_worker_runs set finished_at=clock_timestamp(),status=${String(detail.status)},detail=${sql.json(detail as never)} where id=${run.id}`;
    return detail;
  } catch {
    await sql`update sports_feed.nfl_worker_runs set finished_at=clock_timestamp(),status='failed',detail=${sql.json({ error: "SOURCE_OR_CONFIGURATION_UNAVAILABLE", task, season })} where id=${run.id}`;
    throw Error("NFL collection unavailable; inspect private worker health");
  }
}
