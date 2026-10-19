import { prizePackProduct } from "../core/paid-pack-catalogue";
type Query = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, any>[] }>;
/** Explicit release operation after the new catalogue is registered. No payouts. */
export async function applyWeeklyPrizeTemplates(
  query: Query,
  firstSeason: number,
  firstWeek: number,
) {
  if (
    !Number.isInteger(firstSeason) ||
    firstSeason < 2026 ||
    !Number.isInteger(firstWeek) ||
    firstWeek < 1 ||
    firstWeek > 30
  )
    throw Error("Reviewed season and first week required");
  await query("select pg_advisory_xact_lock(71820342)");
  for (const mode of ["SALARY_CAP", "OPEN"] as const) {
    await query(
      `insert into beta_fantasy.weekly_prize_templates(sport,mode,first_season,first_week,product_version,active) values('nfl',$1,$2,$3,$4,true) on conflict do nothing`,
      [mode, firstSeason, firstWeek, prizePackProduct(mode)],
    );
    const {
      rows: [t],
    } = await query(
      "select * from beta_fantasy.weekly_prize_templates where sport=$1 and mode=$2",
      ["nfl", mode],
    );
    if (
      t.first_season !== firstSeason ||
      t.first_week !== firstWeek ||
      t.product_version !== prizePackProduct(mode) ||
      !t.active
    )
      throw Error("Existing template differs; explicit review required");
  }
  await query(
    "select beta_fantasy.apply_weekly_prize_template(c) from beta_fantasy.competitions c where sport='nfl' and scored_at is null",
  );
  return {
    firstSeason,
    firstWeek,
    awardsIssued: 0,
    seasonPrizesChanged: false,
  };
}
