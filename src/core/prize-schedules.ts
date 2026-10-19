import { z } from "zod";
import { paidPackOffers } from "./paid-pack-catalogue";
export const prizeItem = z
  .object({
    from: z.number().int().min(1).max(100000),
    to: z.number().int().min(1).max(100000),
    description: z.string().trim().min(1).max(240),
    type: z.enum(["credits", "card", "pack", "other"]),
    amount: z.number().int().positive().max(1e9),
    productVersion: z.string().min(1).max(160).optional(),
  })
  .strict();
export const prizeItems = z
  .array(prizeItem)
  .min(1)
  .max(100)
  .superRefine((items, ctx) => {
    let end = 0;
    for (const item of [...items].sort((a, b) => a.from - b.from)) {
      if (item.from <= end || item.to < item.from)
        ctx.addIssue({
          code: "custom",
          message: "Finishing ranges must not overlap",
        });
      end = item.to;
    }
  });
export const prizeCommand = z
  .object({
    action: z.literal("prizes"),
    competition: z.string().uuid(),
    scope: z.enum(["weekly", "season"]),
    items: prizeItems,
    publish: z.boolean(),
    revision: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type PrizeItem = z.infer<typeof prizeItem>;
export function prizeRewardLabel(item: PrizeItem) {
  const product =
    item.type === "pack" &&
    paidPackOffers.find((p) => p.id === item.productVersion);
  return product ? `${item.amount} × ${product.name} NFL` : item.description;
}
export function finishingPosition(position: number) {
  const ending = position % 100;
  return `${position}${ending >= 11 && ending <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] ?? "th")}`;
}
export type PrizeSchedule = {
  id: string;
  sport: string;
  mode: string;
  season: string;
  scope: "weekly" | "season";
  week: number;
  items: PrizeItem[];
};
export type PrizeCompetition = {
  id: string;
  name: string;
  sport: string;
  mode: string;
  season: string;
  week: number;
};
export type PrizeAdminView = {
  schedules: (Omit<PrizeSchedule, "items"> & {
    competition_id: string;
    draft: PrizeItem[];
    published: PrizeItem[] | null;
    revision: number;
  })[];
  competitions: PrizeCompetition[];
  names: { user: string; name: string }[];
  audit: {
    actor: string;
    action: string;
    subject: string;
    created_at: string;
    details: Record<string, unknown>;
  }[];
};
export function prizeSelection(
  competitions: PrizeCompetition[],
  query: Record<string, string | undefined>,
  sport: string,
) {
  const requested = competitions.find(
    (c) => c.id === query.competition && c.sport === sport,
  );
  const mode =
    query.mode === "OPEN" || query.mode === "SALARY_CAP"
      ? query.mode
      : (requested?.mode ?? "SALARY_CAP");
  const options = competitions.filter(
    (c) => c.sport === sport && c.mode === mode,
  );
  const seasons = [...new Set(options.map((c) => c.season))].sort().reverse();
  const season = seasons.includes(query.season ?? "")
    ? query.season!
    : (requested?.season ?? seasons[0] ?? "");
  const weeks = options
    .filter((c) => c.season === season)
    .sort((a, b) => b.week - a.week || a.id.localeCompare(b.id));
  const round =
    weeks.find((c) => c.id === query.competition) ??
    weeks.find((c) => c.week === Number(query.week)) ??
    weeks[0];
  const period = query.period === "season" ? "season" : "weekly";
  return { mode, season, seasons, weeks, round, period };
}
export function competitionHref(
  path: string,
  query: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const key of [
    "sport",
    "competition",
    "mode",
    "period",
    "season",
    "week",
    "series",
  ])
    if (query[key]) params.set(key, query[key]!);
  return `${path}?${params}`;
}
