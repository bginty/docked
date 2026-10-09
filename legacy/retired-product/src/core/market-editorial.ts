import type { MonitoredMarkets } from "./market-data";

/** Optional factual writing aid. It neither creates nor publishes a CMS article. */
export function marketEditorialDraft(data: MonitoredMarkets) {
  if (
    data.status !== "READY" ||
    !data.events.length ||
    !data.provider ||
    !data.observedAt ||
    !Number.isFinite(Date.parse(data.observedAt)) ||
    !data.configurationReference ||
    !/^[a-f0-9]{64}$/.test(data.configurationReference.hash)
  )
    return null;
  const events = [...data.events].sort(
    (a, b) =>
      a.startAt.localeCompare(b.startAt) || a.eventId.localeCompare(b.eventId),
  );
  if (
    events.some(
      (e) =>
        !e.eventId || !e.eventLabel || !Number.isFinite(Date.parse(e.startAt)),
    )
  )
    return null;
  const lines = events.map(
    (e) =>
      `${e.eventLabel} — ${e.competition}; ${e.startAt} (UTC); observed status: ${e.status.replaceAll("_", " ")}.`,
  );
  return {
    status: "DRAFT" as const,
    autoPublication: false as const,
    title: `Monitored ${data.window === "weekend" ? "weekend" : data.window === "today" ? "today's" : "upcoming"} fixtures`,
    body: [
      "DRAFT — requires editorial review before publication.",
      `This bounded monitored subset contains ${events.length} fixture${events.length === 1 ? "" : "s"}. It is not a count of every fixture or market covered by the supplier.`,
      ...lines,
      "These are sporting schedule observations, not recommendations, qualifying Edges or predictions. Start times and event status can change; check the source observations again before publication.",
    ].join("\n\n"),
    eventIds: events.map((e) => e.eventId),
    asOf: data.observedAt,
    provider: data.provider,
    configurationReference: data.configurationReference,
    displayedSubsetCount: events.length,
    coverage: "BOUNDED_MONITORED_SUBSET" as const,
    window: { from: data.from, to: data.to, timezone: data.timezone },
  };
}
