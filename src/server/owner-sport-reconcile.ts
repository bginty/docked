import type { Sql } from "postgres";
import { z } from "zod";
import {
  ownerSportFeed,
  ownerSportMapping,
  previewOwnerSportFeed,
} from "../core/owner-sport-feed";
import { validateAuthorisedScoring } from "../core/authorised-scoring-feed";
import {
  digest,
  importStatistics,
  type Operator,
  type ScoringState,
} from "../core/scoring-engine";
import { SportsFeedStore } from "./sports-feed-store";
import { savepointConnection } from "./sql-savepoint";

/** Reviewed operator permit, never supplied by the scraper payload. A free-beta
 * permit is not collectible issuance permission or a commercial licence. */
export const ownerFeedPermit = z
  .object({
    provider: z.string().min(1),
    competition: z.enum(["AFL", "NRL", "NBA", "EPL"]),
    intendedUse: z.literal("isolated-free-beta"),
    fantasyUse: z.literal(true),
    storage: z.literal(true),
    evidence: z.url(),
    reviewExpires: z.iso.datetime(),
    maxAgeSeconds: z.number().int().min(1).max(86400),
    rawRetentionDays: z.number().int().min(1).max(365),
    liveUse: z.boolean(),
  })
  .strict();

/** Canonical push/file handoff from the separate data service. Uses the existing
 * scoring journal and correction policy; no second scraper or score calculator.
 * The mapping is operator-owned and frozen by the first successful import. */
export async function reconcileOwnerSportFeed(
  sql: Sql,
  streamId: string,
  raw: unknown,
  mappingInput: unknown,
  permitInput: unknown,
  operator: Operator,
  now = new Date().toISOString(),
  correctionReason?: string,
) {
  const feed = ownerSportFeed.parse(raw),
    mapping = ownerSportMapping.parse(mappingInput);
  const permit = ownerFeedPermit.parse(permitInput);
  const { rawRetentionDays, liveUse, ...approval } = permit;
  if (feed.status === "live" && !liveUse)
    throw Error("Source is postgame-only");
  if (
    permit.provider !== feed.provider ||
    Date.parse(permit.reviewExpires) <= Date.parse(now)
  )
    throw Error("Current source permission required");
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`sports-feed:${streamId}`},0))`;
    const store = new SportsFeedStore(savepointConnection(tx));
    const [journal] =
      await tx`select body,state_hash from sports_feed.journal where stream_id=${streamId} order by revision desc limit 1`;
    if (
      !journal ||
      digest(journal.body) !== journal.state_hash ||
      journal.body.scope !== "authorised-free-beta"
    )
      throw Error("Authorised scoring journal unavailable or corrupt");
    const state = journal.body as ScoringState;
    if (state.period.sport !== mapping.sport)
      throw Error("Period sport mismatch");
    const fixture = state.period.fixtures.find(
      (f) => f.id === mapping.fixtureId,
    );
    if (
      !fixture ||
      digest([...fixture.playerIds].sort()) !==
        digest(mapping.players.map((p) => p.playerId).sort())
    )
      throw Error("Frozen fixture/player mapping mismatch");
    const preview = previewOwnerSportFeed(
      feed,
      mapping,
      state.period.rules,
      now,
    );
    validateAuthorisedScoring(
      preview.snapshot,
      approval,
      {
        sport: mapping.sport,
        fixtureId: mapping.fixtureId,
        playerIds: fixture.playerIds,
        scoringVersion: state.period.rules.version,
      },
      now,
    );
    // Authoritative aliases must have been reviewed; no name/fuzzy matching.
    const catalogueSport = mapping.sport === "epl" ? "football" : mapping.sport;
    for (const p of mapping.players) {
      const [alias] =
        await tx`select player_id from sports_feed.player_aliases where sport=${catalogueSport}
        and provider=${mapping.provider} and provider_player_id=${p.providerPlayerId}`;
      if (!alias || alias.player_id !== p.playerId)
        throw Error("Player identity mapping not reviewed");
    }
    const resource = digest({
      kind: "owner-sport-v1",
      streamId,
      fixtureId: mapping.fixtureId,
      mapping,
    });
    const mappingHash = digest(mapping);
    const [frozen] =
      await tx`select mapping_hash from sports_feed.canonical_mappings where stream_id=${streamId} and fixture_id=${mapping.fixtureId}`;
    if (frozen && frozen.mapping_hash !== mappingHash)
      throw Error(
        "Frozen source mapping changed; reconciliation review required",
      );
    const prior = state.sources
      .filter((s) => s.fixtureId === mapping.fixtureId)
      .at(-1);
    if (prior && feed.revision <= prior.revision) {
      if (digest(prior) === digest(preview.snapshot))
        return { state, replay: true, issues: preview.missingPlayerIds };
      throw Error("Stale or conflicting source revision");
    }
    // Store mapping with the raw envelope so replay can verify the exact identity
    // mapping, season and rule version, not just a free-form evidence URL.
    const body = { schemaVersion: 1, feed, mapping },
      bodyHash = digest(body);
    await tx`insert into sports_feed.canonical_mappings(stream_id,fixture_id,mapping_hash,mapping)
      values(${streamId},${mapping.fixtureId},${mappingHash},${tx.json(mapping)}) on conflict do nothing`;
    const expires = new Date(
      Math.min(
        Date.parse(permit.reviewExpires),
        Date.parse(feed.observedAt) + rawRetentionDays * 86400000,
      ),
    ).toISOString();
    await tx`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)
      values(${feed.provider},${resource},${bodyHash},${tx.json(JSON.parse(JSON.stringify(body)))},${feed.observedAt},${permit.evidence},${expires}) on conflict do nothing`;
    const [record] =
      await tx`select id from sports_feed.raw_revisions where provider=${feed.provider} and resource=${resource} and body_hash=${bodyHash} and body is not null`;
    const updated = await store.change(
      streamId,
      (s) =>
        importStatistics(
          s,
          preview.snapshot,
          operator,
          now,
          correctionReason,
          approval,
        ),
      Number(record.id),
    );
    return { state: updated, replay: false, issues: preview.missingPlayerIds };
  });
}
