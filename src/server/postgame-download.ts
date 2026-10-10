import { z } from "zod";
import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";
import {
  digest,
  importStatistics,
  type Operator,
} from "../core/scoring-engine";
import {
  nflversePostgame,
  nflverseRequiredColumns,
  parseStatisticsCsv,
  type PostgameMapping,
} from "../core/postgame-nflverse";
import { SportsFeedStore } from "./sports-feed-store";

const permitSchema = z
  .object({
    provider: z.literal("nflverse"),
    enabled: z.literal(true),
    scope: z.literal("isolated-free-beta"),
    automatedDownload: z.literal(true),
    fantasyUse: z.literal(true),
    storage: z.literal(true),
    derivedUse: z.literal(true),
    evidence: z.url(),
    expiresAt: z.iso.datetime(),
    rawRetentionDays: z.number().int().min(7).max(90),
  })
  .strict();
export type PostgamePermit = z.infer<typeof permitSchema>;
export function requirePostgamePermit(raw: unknown, now: Date) {
  const p = permitSchema.parse(raw);
  if (!Number.isFinite(+now) || Date.parse(p.expiresAt) <= +now)
    throw Error("Post-game source review expired");
  return p;
}
export function postgameResource(season: number) {
  z.number().int().min(1999).max(2100).parse(season);
  return digest({ provider: "nflverse", dataset: "stats_player_week", season });
}
export function postgameChecks(endedAt: string) {
  const start = Date.parse(z.iso.datetime().parse(endedAt));
  return [6, 24, 48, 96, 168].map((h) =>
    new Date(start + h * 3600000).toISOString(),
  );
}

/** Official public release download, not a page scraper. Only GitHub's expected
 * release-asset redirect is followed. Credentials/cookies are never supplied. */
export async function fetchNflverseCsv(
  season: number,
  cached: { etag?: string | null; modified?: string | null },
  fetcher = fetch,
) {
  postgameResource(season);
  let url = `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
  const headers: Record<string, string> = {
    "User-Agent": "Docked-PostgameResearch/1.0 (+https://docked.com.au)",
    Accept: "text/csv, application/octet-stream",
  };
  if (cached.etag) headers["If-None-Match"] = cached.etag;
  if (cached.modified) headers["If-Modified-Since"] = cached.modified;
  const signal = AbortSignal.timeout(20000);
  let response: Response | undefined;
  for (let hop = 0; hop < 3; hop++) {
    response = await fetcher(url, {
      headers,
      redirect: "manual",
      cache: "no-store",
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const next = new URL(response.headers.get("location") ?? "", url);
    if (
      next.protocol !== "https:" ||
      next.username ||
      next.password ||
      next.port ||
      next.hostname !== "release-assets.githubusercontent.com"
    )
      throw Error("Unexpected download redirect");
    url = next.href;
    await response.body?.cancel();
  }
  if (response?.status === 304) return { notModified: true as const };
  if (!response?.ok)
    throw Error(`Post-game source HTTP ${response?.status ?? "unavailable"}`);
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (
    ![
      "text/csv",
      "text/plain",
      "application/octet-stream",
      "application/csv",
    ].includes(contentType ?? "")
  )
    throw Error("Unexpected source content type");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Source body missing");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 12_000_000) {
      await reader.cancel();
      throw Error("Download exceeds limit");
    }
    chunks.push(part.value);
  }
  const csv = Buffer.concat(chunks).toString("utf8"),
    rows = parseStatisticsCsv(csv);
  if (
    !rows.length ||
    nflverseRequiredColumns.some((c) => !(c in rows[0])) ||
    rows.some((r) => r.season !== String(season))
  )
    throw Error("Source schema/season changed");
  const modified = response.headers.get("last-modified");
  if (
    modified &&
    (!Number.isFinite(Date.parse(modified)) ||
      Date.parse(modified) > Date.now() + 60000)
  )
    throw Error("Invalid source timestamp");
  return {
    notModified: false as const,
    csv,
    etag: response.headers.get("etag"),
    modified,
  };
}

/** Operator process only. Durable per-season 12-hour reservation covers failures
 * and parallel workers. No automatic external scheduler or HTTP write route. */
export async function downloadPostgame(
  sql: Sql,
  approval: unknown,
  season: number,
  completion: { observedCompletedAt: string; evidence: string },
  fetcher = fetch,
) {
  const permit = requirePostgamePermit(approval, new Date()),
    resource = postgameResource(season);
  z.url().parse(completion.evidence);
  const completed = Date.parse(
    z.iso.datetime().parse(completion.observedCompletedAt),
  );
  if (Date.now() < completed + 6 * 3600000)
    throw Error("Post-game first check not due");
  const lease = randomUUID();
  const rows =
    await sql`insert into sports_feed.postgame_cache(resource,next_attempt,lease)
    values(${resource},clock_timestamp()+interval '12 hours',${lease})
    on conflict(resource) do update set next_attempt=clock_timestamp()+interval '12 hours',lease=${lease}
    where sports_feed.postgame_cache.next_attempt<=clock_timestamp() returning *`;
  if (!rows.length) return { status: "cooldown" as const };
  const cache = rows[0];
  const [retained] =
    await sql`select * from sports_feed.raw_revisions where id=${cache.raw_id ?? null} and body is not null and expires_at>clock_timestamp()`;
  try {
    await new SportsFeedStore(sql).purgeExpired();
    const fetched = await fetchNflverseCsv(
      season,
      retained ? { etag: cache.etag, modified: cache.source_modified } : {},
      fetcher,
    );
    if (fetched.notModified && !retained)
      throw Error("304 without retained evidence");
    requirePostgamePermit(permit, new Date());
    const rawId = await sql.begin(async (tx) => {
      const [held] =
        await tx`select lease from sports_feed.postgame_cache where resource=${resource} for update`;
      if (held?.lease !== lease) throw Error("Expired download lease");
      let id = retained?.id;
      if (!fetched.notModified) {
        const payload = {
          csv: fetched.csv,
          sourceModifiedAt: fetched.modified,
          source: `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`,
        };
        await tx`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)
          values('nflverse',${resource},${digest(payload)},${tx.json(payload)},clock_timestamp(),${permit.evidence},clock_timestamp()+make_interval(days=>${permit.rawRetentionDays})) on conflict do nothing`;
        const [raw] =
          await tx`select id from sports_feed.raw_revisions where provider='nflverse' and resource=${resource} and body_hash=${digest(payload)} and body is not null and expires_at>clock_timestamp()`;
        if (!raw)
          throw Error("Expired identical evidence requires retention purge");
        id = raw.id;
      }
      await tx`update sports_feed.postgame_cache set raw_id=${id},etag=${fetched.notModified ? cache.etag : fetched.etag},
        source_modified=${fetched.notModified ? cache.source_modified : fetched.modified},checked_at=clock_timestamp(),
        completion_evidence=${completion.evidence},completion_observed_at=${completion.observedCompletedAt},error_code=null,lease=null where resource=${resource}`;
      return Number(id);
    });
    return {
      status: fetched.notModified
        ? ("not-modified" as const)
        : ("downloaded" as const),
      rawId,
    };
  } catch {
    await sql`update sports_feed.postgame_cache set error_code='SOURCE_UNAVAILABLE_OR_SCHEMA_CHANGED',lease=null where resource=${resource} and lease=${lease}`;
    throw Error(
      "Post-game source unavailable or schema changed; scores remain pending",
    );
  }
}

export async function reconcilePostgame(
  sql: Sql,
  period: string,
  rawId: number,
  mapping: PostgameMapping,
  approval: unknown,
  operator: Operator,
  requestedAt?: string,
  lateReason?: string,
) {
  const permit = requirePostgamePermit(
    approval,
    new Date(requestedAt ?? Date.now()),
  );
  if (!operator.id || !["importer", "reviewer"].includes(operator.role))
    throw Error("Operator required");
  const [raw] =
    await sql`select r.*,c.checked_at,clock_timestamp() reconciled_at from sports_feed.raw_revisions r join sports_feed.postgame_cache c on c.raw_id=r.id
    where r.id=${rawId} and r.provider='nflverse' and r.resource=${postgameResource(mapping.season)} and r.expires_at>clock_timestamp()`;
  if (!raw) throw Error("Post-game raw/cache identity unavailable");
  const at = requestedAt ?? new Date(raw.reconciled_at).toISOString();
  if (digest(raw.body) !== raw.body_hash)
    throw Error("Post-game raw hash mismatch");
  if (Date.parse(at) - +new Date(raw.checked_at) > 86400000)
    throw Error("Post-game cache stale");
  if (+new Date(raw.checked_at) > Date.parse(at))
    throw Error("Post-game cache checked in future");
  // Validate before freezing; a typo cannot create a valid-looking permanent map.
  nflversePostgame(
    raw.body.csv,
    mapping,
    1,
    new Date(raw.checked_at).toISOString(),
  );
  const [journal] =
    await sql`select body from sports_feed.journal where stream_id=${period} order by revision desc limit 1`;
  const frozenFixture = journal?.body.period.fixtures.find(
    (f: { id: string }) => f.id === mapping.fixtureId,
  );
  if (
    journal?.body.period.sport !== "nfl" ||
    !frozenFixture ||
    digest([...frozenFixture.playerIds].sort()) !==
      digest(mapping.players.map((p) => p.playerId).sort())
  )
    throw Error("Frozen fixture mapping mismatch");
  await sql`insert into sports_feed.postgame_mapping(stream_id,fixture_id,mapping_hash,mapping,actor)
    values(${period},${mapping.fixtureId},${digest(mapping)},${sql.json(mapping)},${operator.id}) on conflict do nothing`;
  const [frozen] =
    await sql`select mapping_hash from sports_feed.postgame_mapping where stream_id=${period} and fixture_id=${mapping.fixtureId}`;
  if (frozen?.mapping_hash !== digest(mapping))
    throw Error("Provider mapping frozen; audited migration required");
  let issues: string[] = [];
  const state = await new SportsFeedStore(sql).change(
    period,
    (s) => {
      const fixture = s.period.fixtures.find((f) => f.id === mapping.fixtureId);
      if (
        s.period.sport !== "nfl" ||
        !fixture ||
        digest([...fixture.playerIds].sort()) !==
          digest(mapping.players.map((p) => p.playerId).sort())
      )
        throw Error("Frozen fixture mapping mismatch");
      const previous = s.sources
        .filter((x) => x.fixtureId === mapping.fixtureId)
        .at(-1);
      const r = nflversePostgame(
        raw.body.csv,
        mapping,
        (previous?.revision ?? 0) + 1,
        new Date(raw.checked_at).toISOString(),
      );
      issues = r.issues;
      if (
        previous &&
        digest({
          ...r.snapshot,
          revision: previous.revision,
          observedAt: previous.observedAt,
        }) === digest(previous)
      )
        return s;
      return importStatistics(s, r.snapshot, operator, at, lateReason, {
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
    rawId,
  );
  return {
    state,
    issues,
    status: issues.length ? "awaiting-results" : "provisional",
  };
}
