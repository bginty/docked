import { Buffer } from "node:buffer";
import type { Sql } from "postgres";
import { randomUUID, createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { digest } from "../core/scoring-engine";
import {
  completedNflGame,
  nflSourceUrl,
  parseNflDataset,
  type NflDataset,
} from "../core/nflverse-evidence";
import { requirePostgamePermit } from "./postgame-download";
import {
  CollectionFailure,
  collectionDiagnostic,
  type CollectionStage,
} from "./nfl-collection-diagnostics";
import { SportsFeedStore } from "./sports-feed-store";

export const nflResource = (dataset: NflDataset, season: number) =>
  digest({ provider: "nflverse", dataset, season });
export async function fetchNflDataset(
  dataset: NflDataset,
  season: number,
  cached: { etag?: string | null; modified?: string | null },
  fetcher = fetch,
) {
  let url = nflSourceUrl(dataset, season);
  const headers: Record<string, string> = {
    "User-Agent": "Docked-Postgame/1.1 (+https://docked.com.au)",
    Accept: "application/octet-stream, text/csv",
  };
  if (cached.etag) headers["If-None-Match"] = cached.etag;
  if (cached.modified) headers["If-Modified-Since"] = cached.modified;
  const signal = AbortSignal.timeout(45000);
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
    await response.body?.cancel();
    if (
      next.protocol !== "https:" ||
      next.hostname !== "release-assets.githubusercontent.com" ||
      next.username ||
      next.password ||
      next.port
    )
      throw Error("Unexpected source redirect");
    url = next.href;
  }
  if (response?.status === 304) return { notModified: true as const };
  if (!response?.ok) throw Error(`NFL source HTTP ${response?.status}`);
  if (
    ![
      "text/csv",
      "text/plain",
      "application/octet-stream",
      "application/gzip",
      "application/x-gzip",
    ].includes(response.headers.get("content-type")?.split(";")[0] ?? "")
  )
    throw Error("Unexpected NFL content type");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Missing source body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 32_000_000) {
      await reader.cancel();
      throw Error("Source download too large");
    }
    chunks.push(part.value);
  }
  const bytes = Buffer.concat(chunks);
  const csv = (
    dataset === "pbp"
      ? gunzipSync(bytes, { maxOutputLength: 128_000_000 })
      : bytes
  ).toString("utf8");
  const modified = response.headers.get("last-modified");
  if (
    modified &&
    (!Number.isFinite(Date.parse(modified)) ||
      Date.parse(modified) > Date.now() + 60000)
  )
    throw Error("Invalid source timestamp");
  return {
    notModified: false as const,
    etag: response.headers.get("etag"),
    modified,
    body: {
      dataset,
      season,
      source: nflSourceUrl(dataset, season),
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceModifiedAt: modified,
      rows: parseNflDataset(csv, dataset, season),
    },
  };
}

/** A separate cooldown, hash and revision for each dataset. Failures consume the
 * 12h slot too. No provider secrets, no arbitrary URL, no scheduled activation. */
export async function downloadNflDataset(
  sql: Sql,
  approval: unknown,
  dataset: NflDataset,
  season: number,
  fetcher = fetch,
) {
  const permit = requirePostgamePermit(approval, new Date()),
    resource = nflResource(dataset, season),
    lease = randomUUID();
  const [cache] =
    await sql`insert into sports_feed.postgame_cache(resource,next_attempt,lease) values(${resource},clock_timestamp()+interval '12 hours',${lease}) on conflict(resource) do update set next_attempt=clock_timestamp()+interval '12 hours',lease=${lease} where sports_feed.postgame_cache.next_attempt<=clock_timestamp() returning *`;
  if (!cache) return { status: "cooldown", rawId: null };
  let stage: CollectionStage = "retention";
  try {
    await new SportsFeedStore(sql).purgeExpired();
    const [retained] =
      await sql`select * from sports_feed.raw_revisions where id=${cache.raw_id ?? null} and body is not null and expires_at>clock_timestamp()`;
    stage = "fetch";
    const data = await fetchNflDataset(
      dataset,
      season,
      retained ? { etag: cache.etag, modified: cache.source_modified } : {},
      fetcher,
    );
    if (data.notModified && !retained)
      throw Error("304 without retained evidence");
    requirePostgamePermit(permit, new Date());
    stage = "persist";
    const rawId = await sql.begin(async (tx) => {
      const [held] =
        await tx`select lease from sports_feed.postgame_cache where resource=${resource} for update`;
      if (held?.lease !== lease) throw Error("Lost source lease");
      let id = retained?.id;
      if (!data.notModified) {
        await tx`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at) values('nflverse',${resource},${digest(data.body)},${tx.json(data.body)},clock_timestamp(),${permit.evidence},clock_timestamp()+make_interval(days=>${permit.rawRetentionDays})) on conflict do nothing`;
        const [raw] =
          await tx`select id from sports_feed.raw_revisions where provider='nflverse' and resource=${resource} and body_hash=${digest(data.body)} and body is not null and expires_at>clock_timestamp()`;
        if (!raw) throw Error("Retained source unavailable");
        id = raw.id;
      }
      await tx`update sports_feed.postgame_cache set raw_id=${id},etag=${data.notModified ? cache.etag : data.etag},source_modified=${data.notModified ? cache.source_modified : data.modified},checked_at=clock_timestamp(),error_code=null,lease=null where resource=${resource}`;
      return Number(id);
    });
    stage = "completion";
    if (dataset === "pbp") await observeNflCompletions(sql, rawId);
    return { status: data.notModified ? "not-modified" : "downloaded", rawId };
  } catch (error) {
    await sql`update sports_feed.postgame_cache set lease=null,error_code='SOURCE_UNAVAILABLE_OR_SCHEMA_CHANGED' where resource=${resource} and lease=${lease}`;
    throw new CollectionFailure(stage, collectionDiagnostic(error));
  }
}

export async function retainedNflSource(
  sql: Sql,
  rawId: number,
  dataset: NflDataset,
  season: number,
) {
  const [r] =
    await sql`select r.*,c.checked_at from sports_feed.raw_revisions r join sports_feed.postgame_cache c on c.raw_id=r.id where r.id=${rawId} and r.provider='nflverse' and r.resource=${nflResource(dataset, season)} and r.body is not null and r.expires_at>clock_timestamp() and c.checked_at>clock_timestamp()-interval '24 hours'`;
  if (
    !r ||
    digest(r.body) !== r.body_hash ||
    r.body.dataset !== dataset ||
    r.body.season !== season
  )
    throw Error("Retained NFL source mismatch/stale");
  return r;
}
export async function observeNflCompletions(sql: Sql, rawId: number) {
  const [raw] =
    await sql`select body,body_hash from sports_feed.raw_revisions where id=${rawId} and body is not null and expires_at>clock_timestamp()`;
  if (!raw || raw.body.dataset !== "pbp" || digest(raw.body) !== raw.body_hash)
    throw Error("Invalid completion evidence");
  const groups = new Map<string, Record<string, string>[]>();
  for (const p of raw.body.rows) {
    const list = groups.get(p.game_id) ?? [];
    list.push(p);
    groups.set(p.game_id, list);
  }
  const observations = [...groups].map(([gameId, plays]) => ({
    game_id: gameId,
    marker: completedNflGame(plays),
  }));
  await sql.begin(async (tx) => {
    await tx`insert into sports_feed.completion_observations(game_id,raw_id,completed,marker)
      select x.game_id,${rawId},x.marker is not null,x.marker from jsonb_to_recordset(${tx.json(observations)}) x(game_id text,marker jsonb) on conflict do nothing`;
    await tx`insert into sports_feed.completions(game_id,first_observed_at,first_raw_id)
      select x.game_id,clock_timestamp(),${rawId} from jsonb_to_recordset(${tx.json(observations)}) x(game_id text,marker jsonb) where x.marker is not null on conflict do nothing`;
  });
}
