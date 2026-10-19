import { openNflHistory } from "./nfl-history-connection";
import { nflPlayerHistory } from "../core/nfl-player-history";
import { historicalRank, type PlayerRank } from "../core/lineup-auto-select";
/** One consistent published generation and connection for an owned collection. */
export async function publishedLineupRanks(
  players: string[],
  season: string,
  week: number,
  now: number,
) {
  const c = openNflHistory("reader");
  try {
    return await c.db.transaction(async (tx) => {
      await tx.query(
        "set transaction isolation level repeatable read read only",
      );
      const state = (
        await tx.query(
          "select active,last_success,last_error,lease from nfl_history.consumer where id=1",
        )
      ).rows[0];
      if (!state?.active || state.lease || state.last_error)
        throw Error(
          "Verified player history is temporarily unavailable. Try again shortly.",
        );
      const rows = (
        await tx.query(
          `with requested as (select unnest($2::text[]) id), matched as (
        select requested.id,m.dataset,m.canonical,m.position from requested join nfl_history.mappings m on m.docked=requested.id
        union
        select requested.id,m.dataset,m.canonical,m.position from requested join nfl_history.aliases a on a.alias=requested.id join nfl_history.mappings m on m.dataset=a.dataset and m.canonical=a.canonical)
        select m.id,r.payload,g.payload game_payload,m.position from matched m
        join nfl_history.generations v on v.dataset=m.dataset and v.id=$1
        join nfl_history.records r on r.generation=v.id and r.player=m.canonical and not r.removed
        join nfl_history.games g on g.generation=r.generation and g.game=r.game`,
          [state.active, [...new Set(players)]],
        )
      ).rows;
      const ranks: Record<string, PlayerRank | null> = {};
      const grouped = new Map<string, typeof rows>();
      for (const row of rows)
        grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
      for (const id of new Set(players))
        ranks[id] = historicalRank(
          nflPlayerHistory(
            (grouped.get(id) ?? []) as {
              payload: unknown;
              game_payload: unknown;
              position: string;
            }[],
            season,
            state.last_success?.toISOString(),
          ),
          week,
          now,
        );
      return { ranks, asOf: state.last_success?.toISOString() ?? null };
    });
  } finally {
    await c.close();
  }
}
export async function publishedNflHistory(player: string, season?: string) {
  const c = openNflHistory("reader");
  try {
    return await c.db.transaction(async (tx) => {
      await tx.query(
        "set transaction isolation level repeatable read read only",
      );
      const state = (
        await tx.query(
          "select active,last_success,last_error,lease from nfl_history.consumer where id=1",
        )
      ).rows[0];
      if (!state?.active) throw Error("Awaiting initial history publication");
      if (state.lease || state.last_error)
        throw Error(
          "History publication incomplete; retry after reconciliation",
        );
      const rows = await tx.query(
        `select r.payload,g.payload game_payload,m.position from nfl_history.records r
        join nfl_history.generations v on v.id=r.generation
        join nfl_history.mappings m on m.dataset=v.dataset and m.canonical=r.player
        join nfl_history.games g on g.generation=r.generation and g.game=r.game
        where r.generation=$1 and (m.docked=$2 or exists(select 1 from nfl_history.aliases a where a.dataset=m.dataset and a.canonical=m.canonical and a.alias=$2)) and not r.removed`,
        [state.active, player],
      );
      return nflPlayerHistory(
        rows.rows as {
          payload: unknown;
          game_payload: unknown;
          position: string;
        }[],
        season,
        state.last_error ? null : state.last_success?.toISOString(),
      );
    });
  } finally {
    await c.close();
  }
}
