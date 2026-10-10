import {
  fetchSportsFeed,
  requireFeedPermit,
  type FeedRequest,
} from "./sports-feed-client";
import { SportsFeedStore } from "./sports-feed-store";

/** Durable retry-safe fetch step; raw persistence precedes normalization. Configuration
 * is supplied by the operator, not an inbound request. No scheduler is auto-enabled. */
export async function runSportsFetch(
  store: SportsFeedStore,
  approvals: Record<string, unknown>,
  credentials: Record<string, string | undefined>,
  fetcher = fetch,
) {
  const job = await store.claim();
  if (!job) return { status: "idle" };
  const request = job.request as FeedRequest;
  let configured = false;
  try {
    requireFeedPermit(
      approvals[request.provider],
      request.provider,
      new Date(),
    );
    if (!credentials[request.provider]) throw Error("NOT_CONFIGURED");
    configured = true;
    const r = await fetchSportsFeed(
      request,
      approvals[request.provider],
      credentials[request.provider],
      (p) => store.reserveQuota(p),
      fetcher,
    );
    const rawId = await store.record(
      job.id,
      job.lease,
      r.payload,
      r.permit,
      r.observedAt,
    );
    return { status: "recorded", rawId };
  } catch {
    await store.fail(job.id, job.lease, !configured);
    return { status: configured ? "retry-or-blocked" : "not-configured" };
  }
}
