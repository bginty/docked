import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  digest,
  results,
  type CatalogCard,
} from "../../src/core/scoring-engine";
import { nbaWeek, nbaWeeklyRules } from "../../src/core/nba-weekly";
import { sandboxScoreView } from "../../src/core/sandbox-score-view";
import type { multiSportDatabase } from "./multi-sport-db";

/** Isolated synthetic evidence. Builds the real journal from exact SQL entry snapshots. */
export async function seedNbaJournal(
  db: Awaited<ReturnType<typeof multiSportDatabase>>,
) {
  const base = await db.state(),
    id = db.rounds.OPEN1;
  const comp = base.competitions.find((c: any) => c.id === id);
  const entries = base.entries.filter((e: any) => e.competition_id === id);
  const fixtures = (
    await db.q(
      "select fixtures from sports_feed.sport_rounds where competition_id=$1",
      [id],
    )
  )[0].fixtures;
  const w = nbaWeek(comp.locks_at);
  let state = createPeriod(
    {
      id: `sim:basketball:${id}`,
      sport: "basketball",
      label: "Synthetic NBA week",
      locksAt: comp.locks_at,
      rules: nbaWeeklyRules(),
      window: { start: w.start, end: w.end, timezone: w.timezone },
      fixtures: fixtures.map((f: any) => ({
        id: f.fixtureId,
        scheduledAt: f.scheduledAt,
        playerIds: f.playerIds,
      })),
    },
    "2099-01-01T00:00:00Z",
  );
  const catalog: CatalogCard[] = entries.flatMap((e: any) =>
    e.snapshot.map((c: any) => ({
      cardId: c.card_id,
      playerId: c.player_id,
      position: c.position,
      eligiblePositions: c.eligible_positions,
      sport: "basketball",
      owner: e.user_id,
      eligible: true,
    })),
  );
  for (const entry of entries) {
    state = saveTeam(
      state,
      entry.user_id,
      entry.user_id === db.user ? "QA Home" : "QA Away",
      entry.snapshot.map((c: any) => c.card_id),
      catalog,
      "2099-01-01T00:00:00Z",
    );
    const saved = state.entries.find((e) => e.member === entry.user_id)!;
    saved.cards = saved.cards.map((c) => ({
      ...c,
      slot: entry.snapshot.find((s: any) => s.card_id === c.cardId).slot,
    }));
  }
  state = lockTeams(state, catalog, comp.locks_at);
  const rules = state.period.rules;
  await db.q("insert into scoring_beta.rules values($1,$2,$3,$4)", [
    rules.version,
    rules.sport,
    digest(rules),
    JSON.stringify(rules),
  ]);
  await db.q(
    "insert into scoring_beta.streams(id,sport,rules_version) values($1,$2,$3)",
    [state.period.id, "basketball", rules.version],
  );
  let revision = 0,
    previous = "";
  const append = async () => {
    const hash = digest(state);
    await db.q(
      "insert into scoring_beta.journal(stream_id,revision,previous_hash,state_hash,body,calculated)values($1,$2,$3,$4,$5,$6)",
      [
        state.period.id,
        ++revision,
        previous,
        hash,
        JSON.stringify(state),
        JSON.stringify(results(state)),
      ],
    );
    previous = hash;
  };
  await append();
  const importGame = async (sourceRevision = 1) => {
    state = importStatistics(
      state,
      {
        provider: "docked-synthetic-v1",
        simulated: true,
        sport: "basketball",
        fixtureId: fixtures[0].fixtureId,
        revision: sourceRevision,
        observedAt: "2099-02-01T04:00:00Z",
        status: "completed",
        endedAt: "2099-02-01T03:00:00Z",
        players: fixtures[0].playerIds.map((playerId: string, i: number) => ({
          playerId,
          availability: i === 0 ? "confirmed-dnp" : "complete",
          stats:
            i === 0
              ? null
              : {
                  points: sourceRevision === 1 ? 28 : 30,
                  rebounds: 9,
                  assists: 7,
                  steals: 2,
                  blocks: 1,
                  turnovers: 3,
                  threePointers: 3,
                },
        })),
      },
      { id: "isolated-reviewer", role: "reviewer" },
      "2099-02-01T04:00:00Z",
    );
    await append();
  };
  return {
    importGame,
    read: async () => {
      const s = await db.state();
      const journals = (
        await db.q("select sports_feed.sandbox_nba_journals() journals")
      )[0].journals;
      return { ...s, scores: sandboxScoreView(s, journals) };
    },
  };
}
