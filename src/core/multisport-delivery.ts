import { z } from "zod";
export const feedSport = z.enum(["epl", "nba", "afl", "nrl"]);
export type FeedSport = z.infer<typeof feedSport>;
export const appSport = {
  epl: "football",
  nba: "basketball",
  afl: "afl",
  nrl: "nrl",
} as const;
export const scoringSport = {
  epl: "epl",
  nba: "basketball",
  afl: "afl",
  nrl: "nrl",
} as const;
const id = z.string().min(1).max(240);
/** Transport 1.1 envelope from the service OpenAPI. Raw payloads stay raw;
 * canonical scoring schemas remain in owner-sport-feed/scoring-provider. */
export const deliveryPage = z.object({
  schema_version: z.literal("1.1"),
  feed_mode: z.literal("postgame"),
  dataset_id: z.uuid(),
  synthetic: z.boolean(),
  data: z
    .array(
      z.object({
        seq: z.number().int().positive().safe(),
        sport: feedSport,
        kind: z.enum([
          "fixture",
          "fixture_state",
          "player_game",
          "removal",
          "roster",
        ]),
        entity: id,
        revision: z.number().int().positive().safe(),
        payload: z.record(z.string(), z.unknown()),
        created_at: z.number().finite().nonnegative(),
      }),
    )
    .max(500),
  next_cursor: z.string().max(300),
  has_more: z.boolean(),
});
export type DeliveryPage = z.infer<typeof deliveryPage>;
export function cursorSequence(
  cursor: string,
  dataset: string,
  sport: FeedSport,
) {
  const prefix = `${dataset}:${sport}:`;
  if (!cursor.startsWith(prefix) || !/^\d+$/.test(cursor.slice(prefix.length)))
    throw Error("Wrong dataset/sport cursor");
  const sequence = Number(cursor.slice(prefix.length));
  if (!Number.isSafeInteger(sequence)) throw Error("Invalid cursor sequence");
  return sequence;
}
export function validateDelivery(
  input: unknown,
  sport: FeedSport,
  expectedDataset: string,
  allowSynthetic = false,
) {
  const p = deliveryPage.parse(input);
  if (p.dataset_id !== expectedDataset || (p.synthetic && !allowSynthetic))
    throw Error("Unapproved dataset or synthetic delivery");
  const end = cursorSequence(p.next_cursor, p.dataset_id, sport);
  let last = 0;
  for (const c of p.data) {
    if (
      c.sport !== sport ||
      c.seq <= last ||
      c.seq > end ||
      c.payload.sport !== sport ||
      c.payload.synthetic !== p.synthetic
    )
      throw Error("Invalid change context or provenance");
    if (c.kind === "player_game" || c.kind === "removal") {
      if (
        c.payload.revision !== c.revision ||
        c.entity !== `${c.payload.fixture_id}:${c.payload.player_id}` ||
        c.payload.removed !== (c.kind === "removal")
      )
        throw Error("Player-game identity mismatch");
    } else if (
      c.kind === "roster"
        ? c.entity !== c.payload.player_id
        : c.entity !== c.payload.id
    )
      throw Error("Entity identity mismatch");
    last = c.seq;
  }
  if ((p.data.length && last !== end) || (!p.data.length && p.has_more))
    throw Error("Non-progressing cursor");
  return p;
}
/** Evidence-backed mapping only. Never choose a legacy identity by display name. */
export function reconcileCatalogueIdentity(
  sport: FeedSport,
  canonical: string,
  dockedId: string | null,
  existing: readonly { id: string; sport: string }[],
  aliases: readonly { canonical: string; dockedId: string }[],
) {
  const prior = aliases.find((a) => a.canonical === canonical);
  if (prior && dockedId && prior.dockedId !== dockedId)
    throw Error("Canonical mapping conflict");
  const chosen = prior?.dockedId ?? dockedId;
  if (!chosen)
    return { status: "review-required" as const, issuanceAllowed: false };
  if (
    !existing.some((p) => p.id === chosen && p.sport === appSport[sport]) ||
    aliases.some((a) => a.dockedId === chosen && a.canonical !== canonical)
  )
    throw Error("Wrong-sport, missing or duplicate catalogue identity");
  return {
    status: "mapped" as const,
    playerId: chosen,
    issuanceAllowed: false,
  };
}
