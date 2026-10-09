import {
  sourceUseDecision,
  validateResearchSource,
  type ResearchSource,
} from "./research-engine";
import { OPENFOOTBALL_REVIEWED_REVISION } from "./research-source-catalogue";
import {
  parseOpenFootballDataset,
  openFootballQualityReport,
} from "./openfootball-dataset";
import { phase5Hash } from "./phase5-hash";
import { createHash } from "node:crypto";
export class ResearchFetchError extends Error {
  constructor(
    public code: string,
    public httpStatus: number | null = null,
    public retryAt: string | null = null,
  ) {
    super(code);
    this.name = "ResearchFetchError";
  }
}
export function researchRetryAt(value: string | null, now: string) {
  if (!value) return null;
  const date = /^\d+$/.test(value.trim())
    ? Date.parse(now) + Number(value.trim()) * 1000
    : Date.parse(value);
  return Number.isFinite(date) && date > Date.parse(now)
    ? new Date(Math.min(date, 8640000000000000)).toISOString()
    : null;
}

/** Exact reviewed resource allowlist; supplied URLs can never become a general-purpose HTTP client. */
export function researchAdapter(source: ResearchSource) {
  const s = validateResearchSource(source);
  const allowed = ["2025-26", "2026-27"].map(
    (season) =>
      `https://raw.githubusercontent.com/openfootball/football.json/${OPENFOOTBALL_REVIEWED_REVISION}/${season}/en.1.json`,
  );
  if (s.accessMethod !== "DATASET" || !allowed.includes(s.endpoint))
    throw Error("NO_REVIEWED_ADAPTER");
  return "OPENFOOTBALL_PINNED_JSON" as const;
}
export function researchDueWindow(
  startAt: string,
  now: string,
  windows: number[],
): number | null {
  const remaining = (Date.parse(startAt) - Date.parse(now)) / 1000;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return (
    [...windows]
      .filter(
        (w) => Number.isInteger(w) && w >= 60 && w <= 604800 && remaining <= w,
      )
      .sort((a, b) => a - b)[0] ?? null
  );
}
export function researchJobKey(input: {
  scheduleId: string;
  eventId: string;
  startAt: string;
  participants: unknown;
  window: number;
}) {
  return `research:${input.scheduleId}:${input.eventId}:${input.startAt}:${phase5Hash(input.participants)}:${input.window}`;
}
export type ResearchFetchResult =
  | {
      status: "NOT_MODIFIED";
      httpStatus: 304;
      etag: string | null;
      lastModified: string | null;
    }
  | {
      status: "SUCCESS";
      httpStatus: 200;
      etag: string | null;
      lastModified: string | null;
      rawHash: string;
      observedAt: string;
      dataset: ReturnType<typeof parseOpenFootballDataset>;
      quality: ReturnType<typeof openFootballQualityReport>;
    };
export async function fetchResearchDataset(
  input: {
    enabled: boolean;
    source: ResearchSource;
    jurisdiction: string;
    now: string;
    etag?: string | null;
    lastModified?: string | null;
  },
  fetcher: typeof fetch,
  clock: () => string,
): Promise<ResearchFetchResult> {
  if (!input.enabled)
    throw new ResearchFetchError("RESEARCH_AUTOMATION_DISABLED");
  researchAdapter(input.source);
  if (
    !sourceUseDecision(input.source, {
      purpose: "AUTOMATED_FETCH",
      asOfTime: clock(),
      jurisdiction: input.jurisdiction,
    }).allowed
  )
    throw new ResearchFetchError("RIGHTS_BLOCKED");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "DockedResearch/1.0 (bounded reviewed dataset ingestion)",
  };
  if (input.etag && input.etag.length <= 256 && !/[\r\n]/.test(input.etag))
    headers["If-None-Match"] = input.etag;
  if (
    input.lastModified &&
    input.lastModified.length <= 128 &&
    !/[\r\n]/.test(input.lastModified)
  )
    headers["If-Modified-Since"] = input.lastModified;
  const response = await fetcher(input.source.endpoint, {
    method: "GET",
    headers,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const etag = response.headers.get("etag"),
    lastModified = response.headers.get("last-modified");
  const safeEtag =
    etag && etag.length <= 256 && !/[\r\n]/.test(etag) ? etag : null;
  const safeModified =
    lastModified && lastModified.length <= 128 && !/[\r\n]/.test(lastModified)
      ? lastModified
      : null;
  if (response.status === 304) {
    if (!headers["If-None-Match"] && !headers["If-Modified-Since"])
      throw new ResearchFetchError("SOURCE_CACHE_MISS", 304);
    return {
      status: "NOT_MODIFIED",
      httpStatus: 304,
      etag: safeEtag,
      lastModified: safeModified,
    };
  }
  if (response.status !== 200)
    throw new ResearchFetchError(
      response.status === 429 ? "SOURCE_RATE_LIMITED" : "SOURCE_HTTP_FAILURE",
      response.status,
      researchRetryAt(response.headers.get("retry-after"), clock()),
    );
  if (Number(response.headers.get("content-length") ?? 0) > 2000000)
    throw new ResearchFetchError("SOURCE_BODY_LIMIT", 200);
  const reader = response.body?.getReader();
  if (!reader) throw new ResearchFetchError("SOURCE_EMPTY_BODY", 200);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > 2000000)
        throw new ResearchFetchError("SOURCE_BODY_LIMIT", 200);
      chunks.push(result.value);
    }
  } finally {
    await reader.cancel();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const raw: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(body),
      ),
      observedAt = clock();
    const dataset = parseOpenFootballDataset(raw, {
      observedAt,
      sourceId: input.source.sourceId,
      sourceVersion: input.source.version,
    });
    if (
      dataset.season !==
      input.source.endpoint.split("/").at(-2)?.replace("-", "/")
    )
      throw new ResearchFetchError("SOURCE_ADAPTER_DEGRADED", 200);
    const quality = openFootballQualityReport(dataset);
    if (quality.status !== "RESEARCH_ONLY")
      throw new ResearchFetchError("SOURCE_ADAPTER_DEGRADED", 200);
    return {
      status: "SUCCESS",
      httpStatus: 200,
      etag: safeEtag,
      lastModified: safeModified,
      rawHash: createHash("sha256").update(body).digest("hex"),
      observedAt,
      dataset,
      quality,
    };
  } catch {
    throw new ResearchFetchError("SOURCE_ADAPTER_DEGRADED", 200);
  }
}
