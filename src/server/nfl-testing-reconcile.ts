import type { Sql } from "postgres";
import {
  digest,
  importStatistics,
  type Operator,
} from "../core/scoring-engine";
import { nflPostgameVersion } from "../core/nfl-postgame-policy";
import {
  feedGame,
  rawPlayerGame,
  playerReadiness,
} from "../core/nfl-testing-feed";
import { SportsFeedStore } from "./sports-feed-store";
import { requirePostgamePermit } from "./postgame-download";
import { NflTestingStore, type FeedDb } from "./nfl-testing-store";

/** Explicit test-only cutover. Reuses the journal, frozen lineups, reviewer gates,
 * raw provenance and whole-fixture importer. No current ownership lookup. */
export async function reconcileTestingGame(
  db: FeedDb,
  sql: Sql,
  generation: string,
  gameId: string,
  actor: Operator,
  approval: unknown,
  lateReason?: string,
) {
  const token = await new NflTestingStore(db).lease();
  try {
    return await reconcileLeased(
      db,
      sql,
      generation,
      gameId,
      actor,
      approval,
      lateReason,
    );
  } finally {
    await db.query(
      "update nfl_test_feed.consumer set lease=null,lease_until=null where lease=$1",
      [token],
    );
  }
}
async function reconcileLeased(
  db: FeedDb,
  sql: Sql,
  generation: string,
  gameId: string,
  actor: Operator,
  approval: unknown,
  lateReason?: string,
) {
  const consumer = (
    await db.query("select last_error from nfl_test_feed.consumer where id=1")
  ).rows[0];
  if (consumer.last_error)
    throw Error("Successful metadata reconciliation required before scoring");
  const permit = requirePostgamePermit(approval, new Date());
  const generationRow = (
    await db.query(
      "select g.* from nfl_test_feed.generations g join nfl_test_feed.consumer c on c.active=g.id where g.id=$1",
      [generation],
    )
  ).rows[0];
  if (!generationRow) throw Error("Only published test generations can score");
  const maps = (
    await db.query(
      "select * from nfl_test_feed.fixtures where dataset=$1 and game=$2",
      [generationRow.dataset, gameId],
    )
  ).rows;
  const watermark = (
    await db.query(
      "select max(id) id from nfl_test_feed.outbox where generation=$1 and game=$2",
      [generation, gameId],
    )
  ).rows[0].id;
  if (!maps.length) {
    await db.query(
      "update nfl_test_feed.outbox set status='unmapped',reason='Reviewed fixture mapping required' where generation=$1 and game=$2 and id<=$3",
      [generation, gameId, watermark],
    );
    return { status: "unmapped" };
  }
  const game = feedGame.parse(
    (
      await db.query(
        "select payload from nfl_test_feed.games where generation=$1 and game=$2",
        [generation, gameId],
      )
    ).rows[0]?.payload,
  );
  const records = (
    await db.query(
      "select r.payload,m.docked,m.position from nfl_test_feed.records r join nfl_test_feed.mappings m on m.canonical=r.player and m.dataset=$3 where r.generation=$1 and r.game=$2",
      [generation, gameId, generationRow.dataset],
    )
  ).rows;
  try {
    for (const mapping of maps) {
      if (
        !mapping.stream.startsWith("beta-real:qa:feed:") ||
        mapping.season !== game.season ||
        mapping.season_type !== game.season_type ||
        mapping.nfl_week !== game.week
      )
        throw Error("Reviewed isolated fixture mapping mismatch");
      const provenance = {
        dataset: generationRow.dataset,
        generation,
        game,
        records: records.map((r) => r.payload),
      };
      const hash = digest(provenance),
        now = new Date().toISOString();
      await db.query(
        "insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at) values('nflverse',$1,$2,$3,$4,$5,$6) on conflict do nothing",
        [
          "testing-feed:" + gameId,
          hash,
          JSON.stringify(provenance),
          now,
          permit.evidence,
          new Date(
            Date.now() + permit.rawRetentionDays * 86400000,
          ).toISOString(),
        ],
      );
      const rawId = Number(
        (
          await db.query(
            "select id from sports_feed.raw_revisions where resource=$1 and body_hash=$2 and body is not null",
            ["testing-feed:" + gameId, hash],
          )
        ).rows[0].id,
      );
      await new SportsFeedStore(sql).change(
        mapping.stream,
        (state) => {
          if (
            state.period.rules.version !== nflPostgameVersion ||
            state.period.inventoryScope ||
            state.period.lineupVersion
          )
            throw Error(
              "Only the separate postgame testing rules are permitted",
            );
          const fixture = state.period.fixtures.find(
            (f) => f.id === mapping.fixture,
          );
          if (!fixture) throw Error("Frozen fixture missing");
          const players = fixture.playerIds.map((playerId) => {
            const row = records.find((r) => r.docked === playerId);
            const ready = playerReadiness(
              row ? rawPlayerGame.parse(row.payload) : undefined,
              game,
              row?.position,
            );
            // A complete player's historical performance can be shown independently;
            // incomplete game coverage NEVER settles an affected competition.
            return {
              playerId,
              availability: ready.competitionReady
                ? ("complete" as const)
                : ("pending" as const),
              stats: ready.competitionReady ? ready.stats : null,
            };
          });
          const old = state.sources
            .filter((s) => s.fixtureId === fixture.id)
            .at(-1);
          const normalized = {
            status:
              game.status === "final"
                ? ("completed" as const)
                : ("scheduled" as const),
            players,
          };
          if (
            old &&
            digest({ status: old.status, players: old.players }) ===
              digest(normalized)
          )
            return state;
          return importStatistics(
            state,
            {
              provider: "nflverse",
              simulated: false,
              sport: "nfl",
              competition: "NFL",
              fixtureId: fixture.id,
              revision: (old?.revision ?? 0) + 1,
              observedAt: now,
              ...normalized,
              endedAt: null,
              completionObservedAt:
                old?.completionObservedAt ??
                (typeof game.final_seen === "number"
                  ? new Date(game.final_seen * 1000).toISOString()
                  : now),
            },
            actor,
            now,
            lateReason,
            {
              provider: "nflverse",
              competition: "NFL",
              intendedUse: "isolated-free-beta",
              fantasyUse: true,
              storage: true,
              evidence: permit.evidence,
              reviewExpires: permit.expiresAt,
              maxAgeSeconds: 86400,
            },
          );
        },
        rawId,
      );
    }
    await db.query(
      "update nfl_test_feed.outbox set status='applied',reason=null where generation=$1 and game=$2 and id<=$3",
      [generation, gameId, watermark],
    );
    return { status: "applied" };
  } catch {
    await db.query(
      "update nfl_test_feed.outbox set status='review',reason='Scoring validation or reviewer approval required' where generation=$1 and game=$2 and id<=$3",
      [generation, gameId, watermark],
    );
    return { status: "review" };
  }
}
