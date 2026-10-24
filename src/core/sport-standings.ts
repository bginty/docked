import type { SandboxState } from "./sport-sandbox";
import type { StandingRound } from "./standings";
import { rarityRule } from "./card-rarity";
import { australianSalaryLabel } from "./approved-australian-rules";
/** Adapt authorised snapshots and authoritative scores to the existing Rankings UI.
 * No totals, ranks or season aggregation are calculated in this presentation layer. */
export function sportStandingRounds(state: SandboxState): StandingRound[] {
  return state.competitions
    .filter((c) => c.sport === state.sport)
    .map((c) => {
      const score = state.scores?.[c.id];
      const locked = Date.parse(c.locks_at) <= Date.parse(state.server_time);
      return {
        sport: state.sport,
        salaryLabel: australianSalaryLabel(
          state.configurations[c.rules.lineup_version],
        ),
        slots: state.configurations[c.rules.lineup_version]?.slots,
        competitionId: c.id,
        label: c.name,
        season: c.season,
        week: c.round,
        mode: c.rules.mode,
        series: c.rules.scoring_version ?? c.rules.lineup_version,
        scoringVersion: c.rules.scoring_version,
        finalised: score?.final ?? false,
        visible: true,
        serverTime: Date.parse(state.server_time),
        closesAt: c.locks_at,
        feedMode: "postgame",
        updatedAt: score?.updatedAt ?? undefined,
        fixtures:
          state.fixtures?.[c.id] ??
          score?.rows.flatMap((r) =>
            r.players.flatMap((p) =>
              p.games.map((g) => ({
                scheduledAt: g.scheduledAt,
                status: g.status,
              })),
            ),
          ),
        rows: state.entries
          .filter((e) => e.competition_id === c.id)
          .map((e) => {
            const row = score?.rows.find((r) => r.user_id === e.user_id);
            return {
              key: e.user_id,
              name:
                row?.name ??
                (e.user_id === state.user_id
                  ? (state.team_name ?? "Your team")
                  : "Team name unavailable"),
              isMe: e.user_id === state.user_id,
              rank: row?.rank ?? null,
              currentRank: row?.rank ?? null,
              centipoints: row?.points ?? null,
              completedPlayers: row?.completed ?? 0,
              totalPlayers:
                state.configurations[c.rules.lineup_version]?.slots.length,
              status: score?.final
                ? "final"
                : locked
                  ? "provisional"
                  : "upcoming",
              lineup:
                !locked && e.user_id !== state.user_id
                  ? null
                  : e.snapshot.map((p) => {
                      const point = row?.players.find(
                        (v) => v.slot === p.slot && v.card_id === p.card_id,
                      );
                      return {
                        ...p,
                        cardId: p.card_id,
                        playerId: p.player_id,
                        team: p.team ?? "",
                        multiplier:
                          state.sport === "basketball" &&
                          c.rules.scoring_version?.includes("rarity")
                            ? rarityRule(p.tier).multiplierTenths / 10
                            : 1,
                        locked,
                        baseCentipoints:
                          point?.games.length &&
                          point.games.every((g) => g.points !== null)
                            ? point.games.reduce((sum, g) => sum + g.points!, 0)
                            : null,
                        centipoints: point?.points ?? null,
                        status:
                          point?.status ??
                          (locked ? "awaiting-statistics" : "upcoming"),
                        fixtures: point?.games.map((g) => ({
                          scheduledAt: g.scheduledAt,
                          status: g.status,
                        })),
                        parts: [],
                      };
                    }),
            };
          }),
      };
    });
}
