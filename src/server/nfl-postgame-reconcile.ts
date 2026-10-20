import type { Sql } from "postgres";
import {
  digest,
  importStatistics,
  type Operator,
} from "../core/scoring-engine";
import {
  nflversePostgame,
  nflverseRequiredColumns,
  type PostgameMapping,
} from "../core/postgame-nflverse";
import { completedNflGame } from "../core/nflverse-evidence";
import { retainedNflSource } from "./nflverse-bundle";
import { requirePostgamePermit } from "./postgame-download";
import { SportsFeedStore } from "./sports-feed-store";

export async function reconcileNflBundle(
  sql: Sql,
  streamId: string,
  weeklyId: number,
  pbpId: number,
  mapping: PostgameMapping,
  approval: unknown,
  actor: Operator,
  lateReason?: string,
) {
  const reconcile = await prepareNflBundleReconciliation(
    sql,
    weeklyId,
    pbpId,
    mapping.season,
  );
  return reconcile(streamId, mapping, approval, actor, lateReason);
}

/** Request-scoped verified sources. Never cache player data across worker runs. */
export async function prepareNflBundleReconciliation(
  sql: Sql,
  weeklyId: number,
  pbpId: number,
  season: number,
) {
  const [weekly, pbp] = await Promise.all([
    retainedNflSource(sql, weeklyId, "weekly", season),
    retainedNflSource(sql, pbpId, "pbp", season),
  ]);
  return async (
    streamId: string,
    mapping: PostgameMapping,
    approval: unknown,
    actor: Operator,
    lateReason?: string,
  ) => {
    if (mapping.season !== season) throw Error("Source season mismatch");
    for (const source of [weekly, pbp]) {
      if (
        Date.parse(source.expires_at) <= Date.now() ||
        Date.parse(source.checked_at) <= Date.now() - 86400000
      )
        throw Error("Retained NFL source expired during reconciliation");
    }
    if (!actor.id || !["importer", "reviewer"].includes(actor.role))
      throw Error("Scoring operator required");
    const permit = requirePostgamePermit(approval, new Date());
    const plays = pbp.body.rows.filter(
      (p: Record<string, string>) => p.game_id === mapping.gameId,
    );
    const marker = completedNflGame(plays);
    if (!marker || marker.home !== mapping.home || marker.away !== mapping.away)
      throw Error("Explicit matching completed-game marker required");
    const [completion] =
      await sql`select c.*,clock_timestamp() at from sports_feed.completions c where game_id=${mapping.gameId}`;
    const [stream] =
      await sql`select purpose from sports_feed.streams where id=${streamId}`;
    if (!completion || !stream)
      throw Error("Completion observation/stream missing");
    const now = new Date(completion.at).toISOString(),
      first = new Date(completion.first_observed_at).toISOString();
    // Publish verified postgame data when available. The scoring engine still
    // enforces its frozen correction/finalisation window independently.
    if (Date.parse(first) > Date.parse(now))
      throw Error("Completion observation is in the future");
    if (
      stream.purpose === "historical-acceptance" &&
      !streamId.startsWith("beta-real:qa:")
    )
      throw Error("Historical namespace required");
    const normalizedMap = {
      ...mapping,
      endedAt: null,
      completionObservedAt: first,
    };
    const gameRows = weekly.body.rows.filter(
      (r: Record<string, string>) => r.game_id === mapping.gameId,
    );
    // Preserve the parser's missing-game semantics when no weekly rows exist.
    // A header-only CSV is a schema failure, not evidence of a confirmed zero.
    const rows = gameRows.length ? gameRows : weekly.body.rows;
    const csv = [
      nflverseRequiredColumns.join(","),
      ...rows.map((r: Record<string, string>) =>
        nflverseRequiredColumns
          .map((k) => `"${(r[k] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    nflversePostgame(csv, normalizedMap, 1, now, plays);
    await sql`insert into sports_feed.postgame_mapping(stream_id,fixture_id,mapping_hash,mapping,actor) values(${streamId},${mapping.fixtureId},${digest(normalizedMap)},${sql.json(normalizedMap)},${actor.id}) on conflict do nothing`;
    const [frozen] =
      await sql`select mapping_hash from sports_feed.postgame_mapping where stream_id=${streamId} and fixture_id=${mapping.fixtureId}`;
    if (frozen?.mapping_hash !== digest(normalizedMap))
      throw Error("Frozen mapping changed");
    let issues: string[] = [];
    const state = await new SportsFeedStore(sql).change(
      streamId,
      (s) => {
        const fixture = s.period.fixtures.find(
          (f) => f.id === mapping.fixtureId,
        );
        if (
          s.period.sport !== "nfl" ||
          !fixture ||
          digest([...fixture.playerIds].sort()) !==
            digest(mapping.players.map((p) => p.playerId).sort())
        )
          throw Error("Frozen fixture mismatch");
        const old = s.sources
          .filter((x) => x.fixtureId === mapping.fixtureId)
          .at(-1);
        const parsed = nflversePostgame(
          csv,
          normalizedMap,
          (old?.revision ?? 0) + 1,
          now,
          plays,
          s.period.rules.version,
        );
        issues = parsed.issues;
        if (
          old &&
          digest({
            ...parsed.snapshot,
            revision: old.revision,
            observedAt: old.observedAt,
          }) === digest(old)
        )
          return s;
        return importStatistics(s, parsed.snapshot, actor, now, lateReason, {
          provider: "nflverse",
          competition: "NFL",
          intendedUse: "isolated-free-beta",
          fantasyUse: true,
          storage: true,
          evidence: permit.evidence,
          reviewExpires: permit.expiresAt,
          maxAgeSeconds: 86400,
        });
      },
      weeklyId,
      { rawId: pbpId, fixtureId: mapping.fixtureId },
    );
    return {
      state,
      issues,
      status: issues.length ? "awaiting-results" : "provisional",
    };
  };
}
