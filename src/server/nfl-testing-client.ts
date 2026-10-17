import { z } from "zod";

const envelope = z
  .object({
    schema_version: z.literal("1.0"),
    dataset_id: z.string().uuid(),
    feed_class: z.literal("development_testing"),
    feed_mode: z.literal("postgame"),
    data: z.unknown(),
  })
  .passthrough();
export class FeedFailure extends Error {
  constructor(public code: string) {
    super(code);
  }
}
/** Operator-side only. No default hosted origin, no redirects, no credential logs. */
export class NflTestingClient {
  private base: URL;
  expectedDataset?: string;
  constructor(
    base: string,
    private key: string,
    allowedOrigins: string[],
    private fetcher: typeof fetch = fetch,
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  ) {
    this.base = new URL(base);
    if (
      !allowedOrigins.includes(this.base.origin) ||
      this.base.pathname !== "/" ||
      this.base.search ||
      this.base.hash ||
      this.base.username ||
      this.base.password ||
      (this.base.protocol !== "https:" &&
        !(
          this.base.protocol === "http:" &&
          ["127.0.0.1", "[::1]", "localhost"].includes(this.base.hostname)
        )) ||
      key.length < 24
    )
      throw new FeedFailure("FEED_CONFIGURATION");
  }
  async get(path: string, params: Record<string, string> = {}) {
    if (!/^\/v1\/[a-z0-9_/-]+$/.test(path)) throw new FeedFailure("FEED_PATH");
    const url = new URL(path, this.base);
    url.search = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 4; attempt++) {
      let delay = 250 * 2 ** attempt;
      try {
        const response = await this.fetcher(url, {
          headers: {
            Authorization: `Bearer ${this.key}`,
            Accept: "application/json",
          },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
        if (response.status === 410)
          throw new FeedFailure("FEED_RESYNC_REQUIRED");
        if (response.status === 401 || response.status === 403)
          throw new FeedFailure("FEED_AUTHENTICATION");
        if (response.status === 429 || response.status >= 500) {
          const retry = response.headers.get("retry-after");
          const seconds =
            retry && /^\d+(\.\d+)?$/.test(retry)
              ? Number(retry)
              : retry
                ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
                : 0;
          if (seconds > 60) throw new FeedFailure("FEED_RETRY_LATER");
          delay = Math.max(
            delay,
            Number.isFinite(seconds) ? seconds * 1000 : 0,
          );
        } else {
          if (!response.ok)
            throw new FeedFailure("FEED_HTTP_" + response.status);
          const raw = await response.text();
          if (raw.length > 8_000_000)
            throw new FeedFailure("FEED_RESPONSE_SIZE");
          const result = envelope.parse(JSON.parse(raw));
          if (
            this.expectedDataset &&
            result.dataset_id !== this.expectedDataset
          )
            throw new FeedFailure("FEED_DATASET_BINDING");
          return result;
        }
      } catch (error) {
        if (error instanceof FeedFailure) throw error;
        if (error instanceof z.ZodError || error instanceof SyntaxError)
          throw new FeedFailure("FEED_INVALID_RESPONSE");
      }
      if (attempt < 3) await this.sleep(delay);
    }
    throw new FeedFailure("FEED_UNAVAILABLE");
  }
}
