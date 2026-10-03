import { z } from "zod";

export const watchlistLabel = "WATCHLIST — NOT A DOCKED EDGE" as const;
/** Exact editorial fields: no fair price, minimum price, odds or EV may enter. */
export const weekendWatchlistSchema = z
  .object({
    kind: z.literal("weekend_watchlist"),
    version: z.literal(1),
    id: z.string().min(1).max(100),
    event: z.string().min(5).max(180),
    sport: z.string().min(1).max(40),
    startAt: z.iso.datetime(),
    whyWatch: z.string().min(30).max(1500),
    informationToEvaluate: z.string().min(30).max(1500),
    status: z.enum(["draft", "published", "withdrawn"]),
    publishedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime(),
    source: z
      .object({
        kind: z.enum(["licensed_provider", "owner_approved_manual"]),
        reference: z.string().min(10).max(1000),
        url: z.url().refine((s) => new URL(s).protocol === "https:"),
        authorizationReference: z.string().min(10).max(1000),
        reviewedBy: z.string().min(3).max(100),
        reviewedAt: z.iso.datetime(),
        observedAt: z.iso.datetime(),
      })
      .strict(),
    corrections: z
      .array(
        z
          .object({
            at: z.iso.datetime(),
            reason: z.string().min(10).max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export type WeekendWatchlistItem = z.infer<typeof weekendWatchlistSchema>;
export function visibleWeekendWatchlist(
  input: readonly unknown[],
  now = Date.now(),
) {
  if (!Number.isFinite(now)) return [];
  return input
    .flatMap((value) => {
      const parsed = weekendWatchlistSchema.safeParse(value);
      if (!parsed.success) return [];
      const item = parsed.data;
      if (
        item.status !== "published" ||
        item.publishedAt === null ||
        Date.parse(item.publishedAt) > now ||
        Date.parse(item.startAt) <= now ||
        Date.parse(item.expiresAt) <= now ||
        Date.parse(item.source.reviewedAt) > now ||
        Date.parse(item.source.observedAt) >
          Date.parse(item.source.reviewedAt) ||
        now - Date.parse(item.source.observedAt) > 7 * 86400000 ||
        item.corrections.some((c) => Date.parse(c.at) > now)
      )
        return [];
      return [item];
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
// No authorised current event source or owner-approved factual entries supplied.
// A reviewed content change may add exact schema-valid items; never invent them.
export const weekendWatchlist: readonly WeekendWatchlistItem[] = [];
