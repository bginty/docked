import { digest, results, type ScoringState } from "./scoring-engine";
import { nbaWeeklyRules, nbaWeek } from "./nba-weekly";
import type { SandboxState } from "./sport-sandbox";

export type SandboxScores = Record<
  string,
  {
    updatedAt: string | null;
    final: boolean;
    rows: {
      user_id: string;
      name: string;
      points: number | null;
      rank: number | null;
      played: number;
      completed: number;
      players: {
        card_id: string;
        slot: string;
        points: number | null;
        status: string;
        games: {
          scheduledAt: string;
          points: number | null;
          status: string;
          revision: number | null;
        }[];
      }[];
    }[];
  }
>;
/** Server-only calculation/projection. Never serialize raw journal or source rows to a browser. */
export function sandboxScoreView(
  state: SandboxState,
  journals: {
    competition_id: string;
    state_hash: string;
    body: ScoringState;
  }[],
): SandboxScores {
  const output: SandboxScores = {};
  for (const journal of journals) {
    const comp = state.competitions.find(
      (c) => c.id === journal.competition_id,
    );
    const body = journal.body;
    const visible = state.entries.filter((e) => e.competition_id === comp?.id);
    if (
      !comp ||
      comp.sport !== "basketball" ||
      comp.rules.lineup_version !== "docked-nba-weekly-lineup-proposal-v1" ||
      Date.parse(comp.locks_at) > Date.parse(state.server_time) ||
      !visible.some((e) => e.user_id === state.user_id)
    )
      continue;
    if (
      digest(body) !== journal.state_hash ||
      body.scope !== "simulated-beta" ||
      body.period.id !== `sim:basketball:${comp.id}` ||
      body.period.sport !== "basketball" ||
      digest(body.period.rules) !== digest(nbaWeeklyRules()) ||
      Date.parse(body.period.locksAt) !== Date.parse(comp.locks_at) ||
      !body.lineupsLockedAt
    )
      throw Error("NBA scoring journal requires reconciliation");
    if (
      body.entries.length !== visible.length ||
      body.entries.some((e) => {
        const entry = visible.find((v) => v.user_id === e.member);
        return (
          !entry ||
          e.cards.length !== entry.snapshot.length ||
          e.cards.some(
            (c) =>
              !entry.snapshot.some(
                (s) =>
                  s.card_id === c.cardId &&
                  s.player_id === c.playerId &&
                  s.slot === c.slot &&
                  // Every locked game must agree, even after transfers or fixture revisions.
                  digest([...(s.fixture_ids ?? [])].sort()) ===
                    digest(
                      body.period.fixtures
                        .filter((f) => f.playerIds.includes(c.playerId))
                        .map((f) => f.id)
                        .sort(),
                    ),
              ),
          )
        );
      })
    )
      throw Error("NBA saved lineup and scoring snapshot disagree");
    const scored = results(body);
    output[comp.id] = {
      updatedAt: body.sources.length
        ? body.sources
            .map((s) => s.observedAt)
            .sort()
            .at(-1)!
        : null,
      final: !!body.finalisedAt,
      rows: scored.rows.map((row) => ({
        user_id: row.member,
        name: row.name,
        rank: row.rank,
        points: row.players.some((p) => p.matches.some((m) => m.score !== null))
          ? (row.centipoints ?? row.knownCentipoints)
          : null,
        played: row.players.filter((p) =>
          p.matches.some(
            (m) => m.score !== null && m.availability === "complete",
          ),
        ).length,
        completed: row.players.filter((p) => p.centipoints !== null).length,
        players: row.players.map((p) => {
          const known = p.matches.filter((m) => m.score !== null);
          return {
            card_id: p.cardId,
            slot: p.slot!,
            games: p.matches.map((m) => ({
              scheduledAt: body.period.fixtures.find(
                (f) => f.id === m.fixtureId,
              )!.scheduledAt,
              points: m.score?.centipoints ?? null,
              status:
                m.availability === "confirmed-dnp" && m.score
                  ? "DNP"
                  : m.score
                    ? body.finalisedAt
                      ? "Final"
                      : "Scored"
                    : m.sourceStatus === "completed"
                      ? "Awaiting stats"
                      : m.sourceStatus === "missing"
                        ? "Awaiting postgame data"
                        : m.sourceStatus,
              revision: m.revision,
            })),
            points: known.length
              ? known.reduce((n, m) => n + m.score!.centipoints, 0)
              : null,
            status:
              p.centipoints !== null
                ? p.matches.every((m) => m.availability === "confirmed-dnp")
                  ? "DNP"
                  : body.finalisedAt
                    ? "Final"
                    : "Week scored"
                : p.matches.some((m) =>
                      [
                        "postponed",
                        "rescheduled",
                        "cancelled",
                        "abandoned",
                      ].includes(m.sourceStatus),
                    )
                  ? "Under review"
                  : p.matches.some(
                        (m) => m.sourceStatus === "completed" && !m.score,
                      )
                    ? "Awaiting stats"
                    : known.length
                      ? "More games scheduled"
                      : p.matches.some((m) =>
                            body.period.fixtures.some(
                              (f) =>
                                f.id === m.fixtureId &&
                                Date.parse(f.scheduledAt) <=
                                  Date.parse(state.server_time),
                            ),
                          )
                        ? "Awaiting postgame data"
                        : "Not started",
          };
        }),
      })),
    };
  }
  return output;
}

/** Reuses authoritative per-game scores, not provider fantasy totals. A later
 * published correction replaces the same fixture once. No current-week leakage. */
export function sandboxHistoricalRanks(
  state: SandboxState,
  journals: Parameters<typeof sandboxScoreView>[1],
) {
  const checked = sandboxScoreView(state, journals);
  const output: NonNullable<SandboxState["recommendationRanks"]> = {};
  for (const comp of state.competitions.filter(
    (c) => c.rules.lineup_version === "docked-nba-weekly-lineup-proposal-v1",
  )) {
    const cutoff = Date.parse(nbaWeek(comp.locks_at).start);
    const games = new Map<
      string,
      { player: string; at: number; revision: number; value: number }
    >();
    for (const j of journals.filter((j) => checked[j.competition_id]))
      for (const row of results(j.body).rows)
        for (const player of row.players)
          for (const game of player.matches) {
            const fixture = j.body.period.fixtures.find(
              (f) => f.id === game.fixtureId,
            )!;
            if (
              !game.score ||
              game.availability !== "complete" ||
              !game.updatedAt ||
              Date.parse(game.updatedAt) > Date.parse(state.server_time) ||
              Date.parse(fixture.scheduledAt) >= cutoff
            )
              continue;
            const key = `${player.playerId}:${game.fixtureId}`,
              prior = games.get(key);
            if (!prior || (game.revision ?? 0) > prior.revision)
              games.set(key, {
                player: player.playerId,
                at: Date.parse(fixture.scheduledAt),
                revision: game.revision ?? 0,
                value: game.score.centipoints,
              });
          }
    const values: Record<string, number> = {};
    for (const id of new Set(
      state.cards.map((c) => c.canonical_player_id ?? c.player_id),
    )) {
      const recent = [...games.values()]
        .filter((g) => g.player === id)
        .sort((a, b) => b.at - a.at)
        .slice(0, 5);
      if (recent.length)
        values[id] = Math.round(
          recent.reduce((n, g) => n + g.value, 0) / recent.length,
        );
    }
    output[comp.id] = values;
  }
  return output;
}
