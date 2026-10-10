import { DateTime } from "luxon";
import { z } from "zod";
export function operationFilters(input: Record<string, string | undefined>) {
  const now = DateTime.now().setZone("Australia/Sydney");
  const v = z
    .object({
      start: z.iso.date(),
      end: z.iso.date(),
      sport: z.enum(["all", "football", "nfl", "afl"]),
      scope: z.enum(["live", "beta"]),
      staff: z.enum(["false", "true"]),
    })
    .parse({
      start: input.start ?? now.startOf("month").toISODate(),
      end: input.end ?? now.toISODate(),
      sport: input.sport ?? "all",
      scope: input.scope ?? "live",
      staff: input.staff ?? "false",
    });
  const start = DateTime.fromISO(v.start, { zone: "Australia/Sydney" }),
    end = DateTime.fromISO(v.end, { zone: "Australia/Sydney" }).plus({
      days: 1,
    });
  if (
    !start.isValid ||
    !end.isValid ||
    end <= start ||
    end.diff(start, "days").days > 366
  )
    throw Error("Choose a date range of up to 366 days");
  return { ...v, startAt: start.toUTC().toISO()!, endAt: end.toUTC().toISO()! };
}
export type Operations = {
  scope: string;
  generatedAt: string;
  metrics: Record<string, number>;
  competitions: {
    id: string;
    name: string;
    sport: string;
    round: number;
    locks_at: string;
    scored_at: string | null;
    rules_version: string;
    entries: number;
    scored_entries: number;
    rankings: { member: string; rank: number; score: number }[];
  }[];
  inventory: {
    id: string;
    name: string;
    sport: string;
    tier: string;
    season: string;
    max_supply: number;
    issued: number;
    available_lifetime_supply: number;
    cards: number;
    distinct_serials: number;
  }[];
  reports: { id: string; status: string; created_at: string }[];
  emailFailures: number;
  limitations: string[];
};
export function csv(rows: (string | number | null)[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = String(value ?? "");
          if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
