import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { feedChanges, feedGame } from "../core/nfl-testing-feed";
import { FeedFailure, type NflTestingClient } from "./nfl-testing-client";

export const maxBatchBytes = 2_000_000;
export const batchAudience = "/api/testing/nfl/import";
const envelope = z.object({
  schema_version: z.literal("1.0"),
  dataset_id: z.string().uuid(),
  feed_class: z.literal("development_testing"),
  feed_mode: z.literal("postgame"),
  data: z.array(z.record(z.string(), z.unknown())),
  next_after: z.null(),
});
const schema = z.object({
  batch_version: z.literal("docked-raw-postgame-batch-v1"),
  exported_at: z.number().finite(),
  dataset_id: z.string().uuid(),
  changes: z.array(feedChanges).min(1).max(1000),
  games: envelope,
  players: envelope,
});
export function batchSignature(
  body: Buffer,
  key: string,
  timestamp: string,
  audience = batchAudience,
) {
  return createHmac("sha256", key)
    .update(`${audience}\n${timestamp}\n`)
    .update(body)
    .digest("hex");
}
/** Binary gzip, NOT Content-Encoding:gzip (proxies must not rewrite signed bytes).
 * No fantasy scores, names used as IDs, secrets, or ownership in this contract. */
export function readSignedBatch(
  body: Buffer,
  key: string,
  timestamp: string,
  signature: string,
  expectedDataset: string,
  now = Date.now(),
  audience = batchAudience,
  realOnly = false,
) {
  if (
    key.length < 32 ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    body.length > maxBatchBytes ||
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(batchSignature(body, key, timestamp, audience), "hex"),
    )
  )
    throw new FeedFailure("FEED_BATCH_AUTH");
  const batch = schema.parse(
    JSON.parse(
      gunzipSync(body, { maxOutputLength: 64_000_000 }).toString("utf8"),
    ),
  );
  if (
    batch.dataset_id !== expectedDataset ||
    batch.exported_at > now / 1000 + 60 ||
    batch.exported_at < now / 1000 - 86400
  )
    throw new FeedFailure("FEED_BATCH_DATASET_OR_AGE");
  let seq = 0;
  const events = batch.changes.flatMap((page, index) => {
    if (
      page.dataset_id !== expectedDataset ||
      page.has_more !== index < batch.changes.length - 1
    )
      throw new FeedFailure("FEED_BATCH_PAGES");
    for (const event of page.data) {
      if (
        event.seq <= seq ||
        event.game_id !== event.payload.game_id ||
        event.player_id !== event.payload.player_id ||
        event.revision !== event.payload.revision
      )
        throw new FeedFailure("FEED_BATCH_SEQUENCE");
      seq = event.seq;
    }
    if (page.next_cursor !== `${expectedDataset}:${seq}`)
      throw new FeedFailure("FEED_BATCH_CURSOR");
    return page.data;
  });
  const games = batch.games.data.map((g) => feedGame.parse(g));
  if (
    realOnly &&
    events.some((e) => e.payload.synthetic || e.payload.source !== "nflverse")
  )
    throw new FeedFailure("FEED_SYNTHETIC_OR_UNAPPROVED_SOURCE");
  const players = batch.players.data;
  for (const list of [batch.games, batch.players]) {
    if (
      list.dataset_id !== expectedDataset ||
      list.data.some((r) => typeof r.id !== "string") ||
      new Set(list.data.map((r) => r.id)).size !== list.data.length
    )
      throw new FeedFailure("FEED_BATCH_METADATA");
  }
  const gameIds = new Set(games.map((g) => g.id));
  const playerIds = new Set(players.map((p) => p.id));
  if (
    events.some((e) => !gameIds.has(e.game_id) || !playerIds.has(e.player_id))
  )
    throw new FeedFailure("FEED_BATCH_MISSING_IDENTITY");
  // Same API envelopes and pagination as the separate service. Transport only;
  // revisions, mapping review, game completeness and scoring stay in Docked.
  const client: Pick<NflTestingClient, "get"> = {
    async get(path, params = {}) {
      const base = {
        schema_version: "1.0" as const,
        dataset_id: expectedDataset,
        feed_class: "development_testing" as const,
        feed_mode: "postgame" as const,
      };
      const limit = Math.min(500, Math.max(1, Number(params.limit ?? 200)));
      if (!Number.isInteger(limit)) throw new FeedFailure("FEED_BATCH_LIMIT");
      if (path === "/v1/stat-changes") {
        const cursor = params.cursor ?? `${expectedDataset}:0`;
        if (
          !cursor.startsWith(`${expectedDataset}:`) ||
          !/^\d+$/.test(cursor.slice(37))
        )
          throw new FeedFailure("FEED_RESYNC_REQUIRED");
        const after = Number(cursor.slice(37));
        if (after > seq) throw new FeedFailure("FEED_OLDER_BATCH");
        const remaining = events.filter((e) => e.seq > after);
        const data = remaining.slice(0, limit);
        return {
          ...base,
          data,
          next_cursor: `${expectedDataset}:${data.at(-1)?.seq ?? after}`,
          has_more: remaining.length > limit,
          high_watermark: `${expectedDataset}:${seq}`,
        };
      }
      const list =
        path === "/v1/games" ? games : path === "/v1/players" ? players : null;
      if (!list) throw new FeedFailure("FEED_PATH");
      const remaining = list
        .filter((r) => String(r.id) > (params.after ?? ""))
        .sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
      const data = remaining.slice(0, limit);
      return {
        ...base,
        data,
        next_after: remaining.length > limit ? data.at(-1)!.id : null,
      };
    },
  };
  return {
    client,
    receipt: {
      hash: createHash("sha256").update(body).digest("hex"),
      exportedAt: batch.exported_at,
    },
    counts: {
      events: events.length,
      games: games.length,
      players: players.length,
    },
  };
}
