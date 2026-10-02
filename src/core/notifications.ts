import { DateTime } from "luxon";
export type Preferences = {
  timezone: string;
  paused: boolean;
  digest: "off" | "weekly" | "twice_weekly";
  edgeAlerts: boolean;
  education: boolean;
  quietStart: number;
  quietEnd: number;
};
export function localDay(now: string, zone: string) {
  const t = DateTime.fromISO(now, { zone: "utc" }).setZone(zone);
  if (!t.isValid) throw new Error("Invalid IANA timezone");
  return t.toISODate()!;
}
export function nextQuietEnd(now: string, zone: string, hour: number) {
  const local = DateTime.fromISO(now, { zone: "utc" }).setZone(zone);
  if (!local.isValid) throw new Error("Invalid timezone");
  let end = local.set({ hour, minute: 0, second: 0, millisecond: 0 });
  if (end <= local) end = end.plus({ days: 1 });
  return end.toUTC().toISO()!;
}
export function dispatchDecision(input: {
  now: string;
  environment: string;
  sendingEnabled: boolean;
  consent: boolean;
  preferences: Preferences;
  kind: "edge" | "digest" | "education" | "service";
  eligible: boolean;
  fresh: boolean;
  startAt?: string;
  expiresAt: string;
  sentToday: number;
  globalBudgetRemaining: number;
}) {
  const p = input.preferences,
    t = DateTime.fromISO(input.now, { zone: "utc" }).setZone(p.timezone);
  if (!t.isValid || !Number.isFinite(Date.parse(input.now)))
    return "invalid_timezone";
  if (input.environment !== "production" || !input.sendingEnabled)
    return "preview_or_sending_paused";
  if (
    Date.parse(input.expiresAt) <= Date.parse(input.now) ||
    !Number.isFinite(Date.parse(input.expiresAt))
  )
    return "expired";
  if (input.kind !== "service" && (!input.consent || p.paused))
    return "consent_or_pause";
  if (input.kind !== "service" && !input.eligible) return "region_restricted";
  if (input.globalBudgetRemaining <= 0) return "budget_exhausted";
  if (
    input.kind === "edge" &&
    (!p.edgeAlerts ||
      !input.fresh ||
      !input.startAt ||
      !Number.isFinite(Date.parse(input.startAt)) ||
      Date.parse(input.startAt) - Date.parse(input.now) <= 600000)
  )
    return "edge_invalid";
  if (
    (input.kind === "digest" && p.digest === "off") ||
    (input.kind === "education" && !p.education)
  )
    return "not_opted_in";
  if (
    !Number.isFinite(input.globalBudgetRemaining) ||
    !Number.isFinite(input.sentToday) ||
    input.sentToday < 0
  )
    return "budget_unknown";
  if (input.kind === "edge" && input.sentToday >= 2) return "daily_cap";
  const quiet =
    p.quietStart > p.quietEnd
      ? t.hour >= p.quietStart || t.hour < p.quietEnd
      : t.hour >= p.quietStart && t.hour < p.quietEnd;
  if (input.kind !== "service" && quiet)
    return input.kind === "edge" ? "discard_quiet_hours" : "defer_quiet_hours";
  return "send";
}
export type Schedule = {
  key: string;
  zone: string;
  hour: number;
  minute: number;
  cadence: "daily" | "weekly" | "first_business_day";
  weekday?: number;
  enabled: boolean;
};
export const editorialSchedules: Schedule[] = [
  {
    key: "board-refresh",
    zone: "Australia/Melbourne",
    hour: 7,
    minute: 30,
    cadence: "daily",
    enabled: true,
  },
  {
    key: "weekly-results",
    zone: "Australia/Melbourne",
    hour: 18,
    minute: 0,
    cadence: "weekly",
    weekday: 1,
    enabled: true,
  },
  {
    key: "education-digest",
    zone: "Australia/Melbourne",
    hour: 18,
    minute: 0,
    cadence: "weekly",
    weekday: 2,
    enabled: false,
  },
  {
    key: "weekend-watchlist",
    zone: "Australia/Melbourne",
    hour: 18,
    minute: 0,
    cadence: "weekly",
    weekday: 5,
    enabled: false,
  },
  {
    key: "monthly-report",
    zone: "Australia/Melbourne",
    hour: 18,
    minute: 0,
    cadence: "first_business_day",
    enabled: true,
  },
];
export function dueSlot(s: Schedule, now: string) {
  const t = DateTime.fromISO(now, { zone: "utc" }).setZone(s.zone);
  if (!t.isValid || !s.enabled || t.hour !== s.hour || t.minute !== s.minute)
    return null;
  if (s.cadence === "weekly" && t.weekday !== s.weekday) return null;
  if (s.cadence === "first_business_day") {
    let first = t.startOf("month");
    while (first.weekday > 5) first = first.plus({ days: 1 });
    if (t.day !== first.day) return null;
  }
  return `${s.key}:${t.toISODate()}:${s.hour}:${s.minute}`;
}
export function nextScheduleAt(s: Schedule, after: string): string | null {
  if (!s.enabled) return null;
  const now = DateTime.fromISO(after, { zone: "utc" }).setZone(s.zone);
  if (!now.isValid) throw new Error("Invalid schedule timezone");
  for (let day = 0; day < 40; day++) {
    const candidate = now
      .plus({ days: day })
      .set({ hour: s.hour, minute: s.minute, second: 0, millisecond: 0 });
    if (candidate > now && dueSlot(s, candidate.toUTC().toISO()!))
      return candidate.toUTC().toISO()!;
  }
  throw new Error("Invalid schedule cadence");
}
