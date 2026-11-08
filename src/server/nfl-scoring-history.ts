import { openNflHistory } from "./nfl-history-connection";
import type { FeedDb } from "./nfl-testing-store";
import {
  scoringHistoryPageSize,
  scoringHistoryRows,
  selectedScoringRound,
  sportReferenceRules,
  type PublishedScoringRow,
  type ScoringHistoryQuery,
  type ScoringRound,
  type SportScoringHistory,
} from "../core/sport-scoring-history";

/** One published generation, read-only. No competition/entry join or financial data. */
export async function readPublishedNflScoringHistory(
  database: FeedDb,
  query: ScoringHistoryQuery,
): Promise<SportScoringHistory> {
  if (query.sport !== "nfl") throw Error("History sport mismatch");
  return database.transaction(async (tx) => {
    await tx.query("set transaction isolation level repeatable read read only");
    const state = (
      await tx.query(
        "select active,last_success,last_error,lease from nfl_history.consumer where id=1",
      )
    ).rows[0];
    if (!state?.active) throw Error("Awaiting initial history publication");
    if (state.lease || state.last_error)
      throw Error("History publication incomplete; retry after reconciliation");
    const lastSuccess = state.last_success?.toISOString() ?? null;
    const summary = (
      await tx.query(
        `
      select r.payload->>'season' season,r.payload->>'season_type' season_type,
        (r.payload->>'week')::int round,count(distinct r.game)::int games,
        count(*)::int records,count(m.canonical)::int mapped_records
      from nfl_history.records r
      join nfl_history.generations v on v.id=r.generation
      join nfl_history.games g on g.generation=r.generation and g.game=r.game
      left join nfl_history.mappings m on m.dataset=v.dataset and m.canonical=r.player
      where r.generation=$1 and not r.removed and r.payload->>'synthetic'='false'
        and r.payload->>'season'=g.payload->>'season'
        and r.payload->>'season_type'=g.payload->>'season_type'
        and r.payload->>'week'=g.payload->>'week'
      group by 1,2,3 order by 1 desc,2 desc,3 desc`,
        [state.active],
      )
    ).rows;
    const rounds: ScoringRound[] = summary.map((r) => ({
      season:
        r.season_type === "REG" ? r.season : `${r.season} ${r.season_type}`,
      round: r.round,
      games: r.games,
      records: r.records,
      mappedRecords: r.mapped_records,
    }));
    const { season, round } = selectedScoringRound(rounds, query);
    const base = {
      sport: "nfl" as const,
      rules: sportReferenceRules("nfl"),
      rounds,
      season,
      round,
      lastSuccess,
      page: query.page,
      rows: [],
      total: 0,
      hasMore: false,
    };
    if (
      !season ||
      !round ||
      !rounds.some((r) => r.season === season && r.round === round)
    )
      return base;
    const [year, type = "REG"] = season.split(" ");
    // Names and canonical mapping come from the same published dataset. Match by
    // reviewed identity, never by name. Paging bounds response size on mobile.
    const records = (
      await tx.query(
        `
      select m.docked player,p.payload->>'name' name,m.position,r.payload,
        g.payload game_payload,count(*) over()::int total
      from nfl_history.records r
      join nfl_history.generations v on v.id=r.generation
      join nfl_history.mappings m on m.dataset=v.dataset and m.canonical=r.player
      join nfl_history.players p on p.generation=r.generation and p.player=r.player
      join nfl_history.games g on g.generation=r.generation and g.game=r.game
      where r.generation=$1 and not r.removed and r.payload->>'synthetic'='false'
        and r.payload->>'season'=$2 and r.payload->>'season_type'=$3
        and (r.payload->>'week')::int=$4
        and r.payload->>'season'=g.payload->>'season'
        and r.payload->>'season_type'=g.payload->>'season_type'
        and r.payload->>'week'=g.payload->>'week'
        and length(p.payload->>'name') between 1 and 160
        and strpos(lower(p.payload->>'name'),lower($5))>0
      order by lower(p.payload->>'name'),r.player,r.game
      limit $6 offset $7`,
        [
          state.active,
          year,
          type,
          round,
          query.search,
          scoringHistoryPageSize,
          query.page * scoringHistoryPageSize,
        ],
      )
    ).rows;
    const total = records[0]?.total ?? 0;
    return {
      ...base,
      rows: scoringHistoryRows(
        records as PublishedScoringRow[],
        season,
        round,
        lastSuccess,
      ),
      total,
      hasMore: (query.page + 1) * scoringHistoryPageSize < total,
    };
  });
}

export async function publishedSportScoringHistory(query: ScoringHistoryQuery) {
  const connection = openNflHistory("reader");
  try {
    return await readPublishedNflScoringHistory(connection.db, query);
  } finally {
    await connection.close();
  }
}
