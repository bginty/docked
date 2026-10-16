import { DateTime } from "luxon";
export function ownerReportPeriod(
  query: Record<string, string | undefined>,
  now: DateTime = DateTime.now(),
) {
  if (query.start || query.end) return { query, period: "custom" };
  const period = ["7", "30", "90", "365"].includes(query.period ?? "")
    ? query.period!
    : "30";
  const end = now.setZone("Australia/Sydney").startOf("day");
  return {
    period,
    query: {
      ...query,
      start: end.minus({ days: Number(period) - 1 }).toISODate()!,
      end: end.toISODate()!,
    },
  };
}
