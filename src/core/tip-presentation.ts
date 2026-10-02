export type TipDisplayStatus =
  "active" | "price_below_minimum" | "expired" | "suspended" | "settled";
export type TipPresentation = {
  id: string;
  participants: string[];
  selection: string;
  start_at: string | Date;
  odds: string;
  minimum_odds: string;
  probability: string;
  estimated_ev: string;
  market_rules: { market: string; settlement: string };
  publication_payload: {
    fairOdds: string;
    offer: { bookmaker: string; sourceAt: string };
  };
  result: string;
  display_status: TipDisplayStatus;
  current_odds: string | null;
  current_source_at: string | Date | null;
  current_observed_at: string | Date | null;
};
export const tipStatusLabels: Record<TipDisplayStatus, string> = {
  active: "ACTIVE",
  price_below_minimum: "PRICE BELOW MINIMUM",
  expired: "EXPIRED",
  suspended: "SUSPENDED",
  settled: "SETTLED",
};
export function localEventTime(at: string | Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(at));
  } catch {
    return new Date(at).toISOString();
  }
}
export function sourceAge(at: string | Date | null, now: number) {
  if (!at) return "Source time unavailable";
  const seconds = Math.floor((now - new Date(at).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "Source time unverified";
  const unit =
    seconds < 60
      ? "second"
      : seconds < 3600
        ? "minute"
        : seconds < 86400
          ? "hour"
          : "day";
  const count =
    seconds < 60
      ? seconds
      : Math.floor(
          seconds / (unit === "minute" ? 60 : unit === "hour" ? 3600 : 86400),
        );
  return `${count} ${unit}${count === 1 ? "" : "s"} old`;
}
export function timeBoundStatus(
  status: TipDisplayStatus,
  sourceAt: string | null,
  startAt: string,
  now: number,
): TipDisplayStatus {
  if (!["active", "price_below_minimum"].includes(status)) return status;
  if (Date.parse(startAt) <= now + 600000) return "expired";
  if (
    !sourceAt ||
    !Number.isFinite(Date.parse(sourceAt)) ||
    now < Date.parse(sourceAt) ||
    now - Date.parse(sourceAt) > 180000
  )
    return "suspended";
  return status;
}
