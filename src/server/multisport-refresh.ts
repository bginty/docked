import type { Sql } from "postgres";
import { MultisportDeliveryStore } from "./multisport-delivery-store";
import { feedRequest } from "./multisport-feed-http";
import { serviceScoringPreview } from "../core/multisport-scoring-bridge";
import { reconcileOwnerSportFeed } from "./owner-sport-reconcile";
import { savepointConnection } from "./sql-savepoint";
import { deliveryPage, type FeedSport } from "../core/multisport-delivery";
/** Scheduled caller owns a reviewed source/dataset binding and a dedicated raw
 * delivery role. No direct service-to-member API or production default. */
export async function pullSportPage(
  sql: Sql,
  config: {
    origin: string;
    key: string;
    source: string;
    dataset: string;
    allowSynthetic: boolean;
  },
  sport: FeedSport,
) {
  const [saved] =
    await sql`select cursor from sports_feed.delivery_checkpoints where source=${config.source} and sport=${sport}`;
  const path = `/v1/sports/${sport}/stat-changes?limit=250${saved ? `&cursor=${encodeURIComponent(saved.cursor)}` : ""}`;
  const page = await feedRequest(config, path);
  const result = await new MultisportDeliveryStore(sql, config).apply(
    sport,
    page,
  );
  return { ...result, hasMore: deliveryPage.parse(page).has_more };
}
/** Separate reviewed scoring worker: raw receipt alone never approves scoring.
 * Existing period creation requires all release gates; final corrections still
 * require the existing reviewer workflow. Failures leave the outbox pending. */
export async function refreshServiceFixture(
  sql: Sql,
  binding: {
    source: string;
    sport: FeedSport;
    fixtureId: string;
    streamId: string;
    mapping: unknown;
    permit: unknown;
    sourceEvidence: string;
  },
  now: string,
) {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`delivery:${binding.source}:${binding.sport}`},0))`;
    const [fixture] =
      await tx`select payload,revision from sports_feed.delivery_records where source=${binding.source} and sport=${binding.sport} and kind='fixture' and entity=${binding.fixtureId}`;
    if (!fixture) throw Error("Fixture not received");
    const records =
      await tx`select payload from sports_feed.delivery_records where source=${binding.source} and sport=${binding.sport} and kind='player_game' and payload->>'fixture_id'=${binding.fixtureId}`;
    const preview = serviceScoringPreview({
      fixture: fixture.payload,
      records: records.map((r) => r.payload),
      fixtureRevision: Number(fixture.revision),
      mapping: binding.mapping,
      sourceEvidence: binding.sourceEvidence,
      now,
    });
    const result = await reconcileOwnerSportFeed(
      savepointConnection(tx),
      binding.streamId,
      preview.feed,
      binding.mapping,
      binding.permit,
      { id: "canonical-service-consumer", role: "importer" },
      now,
    );
    await tx`update sports_feed.delivery_recalculations set state=${preview.issues.length ? "blocked" : "applied"},reason=${preview.issues.join("; ").slice(0, 2000) || null} where source=${binding.source} and sport=${binding.sport} and (entity=${binding.fixtureId} or left(entity,length(${binding.fixtureId})+1)=${binding.fixtureId + ":"})`;
    return { replay: result.replay, issues: preview.issues };
  });
}
