import { z } from "zod";

export const feedPermit = z
  .object({
    provider: z.enum(["sportmonks", "sportsdataio"]),
    enabled: z.literal(true),
    scope: z.literal("isolated-free-beta"),
    fantasyUse: z.literal(true),
    rawStorage: z.literal(true),
    derivedStorage: z.literal(true),
    evidence: z.url(),
    expiresAt: z.iso.datetime(),
    unscrambled: z.literal(true),
    maxRequestsPerDay: z.number().int().min(1).max(2000),
    rawRetentionDays: z.number().int().min(1).max(365),
  })
  .strict();
export type FeedPermit = z.infer<typeof feedPermit>;
export const feedRequest = z.union([
  z
    .object({
      provider: z.literal("sportmonks"),
      kind: z.enum(["fixture", "squad"]),
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z
    .object({
      provider: z.literal("sportsdataio"),
      kind: z.literal("boxscore"),
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z
    .object({ provider: z.literal("sportsdataio"), kind: z.literal("players") })
    .strict(),
]);
export type FeedRequest = z.infer<typeof feedRequest>;

export function requireFeedPermit(input: unknown, provider: string, now: Date) {
  const p = feedPermit.parse(input);
  if (
    !Number.isFinite(now.getTime()) ||
    p.provider !== provider ||
    Date.parse(p.expiresAt) <= now.getTime()
  )
    throw Error("Feed rights or activation unavailable");
  return p;
}

/** Fixed vendor hosts/paths; no user URLs, redirects, credentials in query strings,
 * provider error bodies, or automatic retry that can silently burn quota. */
export async function fetchSportsFeed(
  request: FeedRequest,
  approval: unknown,
  secret: string | undefined,
  reserveQuota: (p: FeedPermit) => Promise<void>,
  fetcher: typeof fetch = fetch,
  now = new Date(),
) {
  feedRequest.parse(request);
  const p = requireFeedPermit(approval, request.provider, now);
  if (!secret || secret.length < 8)
    throw Error("Sports provider NOT_CONFIGURED");
  if (
    request.kind !== "players" &&
    (!Number.isSafeInteger(request.id) || request.id <= 0)
  )
    throw Error("Invalid provider identifier");
  const url =
    request.provider === "sportmonks"
      ? request.kind === "squad"
        ? `https://api.sportmonks.com/v3/football/squads/teams/${request.id}?include=player;team;position`
        : `https://api.sportmonks.com/v3/football/fixtures/${request.id}?include=lineups.details.type;events;state;periods;participants`
      : request.kind === "boxscore"
        ? `https://api.sportsdata.io/v3/nfl/stats/json/BoxScoreFinal/${request.id}`
        : "https://api.sportsdata.io/v3/nfl/scores/json/PlayersByAvailable";
  await reserveQuota(p); // persisted BEFORE every attempted request, including failures
  const headers: Record<string, string> =
    request.provider === "sportmonks"
      ? { Authorization: secret }
      : { "Ocp-Apim-Subscription-Key": secret };
  let response: Response;
  try {
    response = await fetcher(url, {
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      "Provider transport unavailable; retry with durable job backoff",
    );
  }
  if (!response.ok)
    throw Error(
      `Provider HTTP ${response.status}; retry only through quota-controlled scheduler`,
    );
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Provider schema unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Provider body missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8_000_000) {
      await reader.cancel();
      throw Error("Provider response exceeds limit");
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.includes(secret))
    throw Error(
      "Provider response contains credential material; storage blocked",
    );
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw Error("Provider JSON malformed");
  }
  // Persist data only, never headers/credential-bearing transport metadata.
  return { payload, observedAt: new Date().toISOString(), request, permit: p };
}
