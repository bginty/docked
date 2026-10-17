import { openNflHistory } from "./nfl-history-connection";
import { nflPlayerHistory } from "../core/nfl-player-history";
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
