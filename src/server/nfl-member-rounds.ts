import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";
import {
  digest,
  results,
  type Period,
  type ScoringState,
} from "../core/scoring-engine";
import { createFreeBetaPeriod } from "../core/free-beta-scoring";
import { validateLineup, type LockedCard } from "../core/scoring-v1";
import { inspectNflRosters } from "../core/nflverse-evidence";
import { SportsFeedStore } from "./sports-feed-store";
import { retainedNflSource } from "./nflverse-bundle";

/** Isolated beta only. Never rename an existing player/card or edit commercial caps. */
export async function refreshNflCatalogue(
  sql: Sql,
  rawId: number,
  season: number,
) {
  const raw = await retainedNflSource(sql, rawId, "rosters", season);
  const roster = inspectNflRosters(raw.body.rows, season);
  if (
    roster.teamCount !== 32 ||
    roster.issues.some((i) => i.includes("Conflicting"))
  )
    throw Error("Complete unambiguous current roster required");
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820342)`;
    const known = new Set(
      (await tx`select provider_id from sports_feed.nfl_players`).map(
        (p) => p.provider_id,
      ),
    );
    const fresh = roster.players
      .filter((p) => p.sourceStatus === "ACT" && !known.has(p.providerId))
      .map((p) => ({ ...p, id: randomUUID(), edition: randomUUID() }));
    const payload = tx.json(fresh);
    await tx`insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season,status) select r.id,r.name,'nfl',r.position,r.team,'#1677FF',1,'unknown','active' from jsonb_to_recordset(${payload})r(id uuid,name text,position text,team text)`;
    await tx`insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status) select r.edition,r.id,'CORE',${String(season)},'regular',11,'launched' from jsonb_to_recordset(${payload})r(id uuid,edition uuid)`;
    await tx`insert into sports_feed.nfl_players select r.id,r."providerId",r.edition,r.team,r."sourceStatus",${rawId},${raw.checked_at},r.team from jsonb_to_recordset(${payload})r(id uuid,"providerId" text,edition uuid,team text,"sourceStatus" text)`;
    await tx`select sports_feed.nfl_refresh_status(${tx.json(raw.body.rows)},${rawId},${raw.checked_at})`;
    // Absence from this complete roster prevents new selection, never means DNP.
    await tx`update sports_feed.nfl_players set source_status='UNCONFIRMED' where not(provider_id=any(${roster.players.map((p) => p.providerId)}))`;
    return {
      added: fresh.length,
      mapped: roster.players.length,
      missingIdentity: roster.issues,
    };
  });
}

export async function registerNflRound(
  sql: Sql,
  period: Period,
  fixtures: unknown[],
  evidence: Parameters<typeof createFreeBetaPeriod>[2],
) {
  const at = new Date().toISOString();
  const state = createFreeBetaPeriod(period, at, evidence);
  if (period.sport !== "nfl" || period.id.startsWith("beta-real:qa:"))
    throw Error("Genuine future NFL round required");
  const existing =
    await sql`select competition_id from sports_feed.nfl_rounds where stream_id=${period.id}`;
  if (existing.length) return existing[0].competition_id as string;
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71820342)`;
    const [prior] =
      await tx`select competition_id from sports_feed.nfl_rounds where stream_id=${period.id}`;
    if (prior) return prior.competition_id as string;
    const scoring = randomUUID(),
      competition = randomUUID();
    await tx`insert into beta_fantasy.scoring_rules(id,version,rules) values(${scoring},${period.rules.version},${tx.json(period.rules)}) on conflict(version) do nothing`;
    const [rules] =
      await tx`select id,rules from beta_fantasy.scoring_rules where version=${period.rules.version}`;
    if (digest(rules.rules) !== digest(period.rules))
      throw Error("Registered scoring version differs");
    await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize) values(${competition},${period.label},'nfl',${period.id.split(":").at(-2)!},${Number(period.id.split(":").at(-1))},${period.locksAt},${tx.json({ positions: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 }, duplicates: false, first_year_min: 0, postgame: true, ...(period.inventoryScope ? { inventory_scope: period.inventoryScope, rarity_version: period.rules.rarityVersion, scoring_version: period.rules.version } : {}) })},${rules.id},'[]','No cash prize')`;
    await tx`insert into beta_fantasy.production_rounds values(${competition})`;
    await tx`insert into sports_feed.streams(id) values(${period.id})`;
    await tx`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values(${period.id},1,'',${digest(state)},${tx.json(state as never)},${tx.json(results(state) as never)})`;
    await tx`insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures) values(${competition},${period.id},'member',${tx.json(fixtures as never)})`;
    const names =
      await tx`select np.player_id,p.name from sports_feed.nfl_players np join beta_fantasy.players p on p.id=np.player_id`;
    if (period.inventoryScope)
      names.push(
        ...(await tx`select id player_id,identity->>'name' name from credits_sandbox.permanent_players where sport='nfl'`),
      );
    await tx`update sports_feed.streams set display_metadata=${tx.json({ players: Object.fromEntries(names.map((p) => [p.player_id, p.name])), source: evidence.source })} where id=${period.id}`;
    return competition;
  });
}

/** Entries are submitted before kickoff through the existing member command.
 * The DB freezes snapshots at deadline; delayed worker execution cannot rewrite them. */
export async function connectLockedNflEntries(sql: Sql, streamId: string) {
  await sql`select sports_feed.nfl_lock_due()`;
  const [round] =
    await sql`select * from sports_feed.nfl_rounds where stream_id=${streamId}`;
  if (!round?.locked_at) return false;
  await new SportsFeedStore(sql).change(streamId, (state) => {
    if (state.lineupsLockedAt) return state;
    const next: ScoringState = structuredClone(state);
    next.entries = round.locked_snapshot.map(
      (e: {
        user_id: string;
        snapshot: {
          card_id: string;
          player_id: string;
          position: string;
          tier?: LockedCard["rarity"];
          multiplierTenths?: number;
          rarityVersion?: string;
          rules_version?: string;
        }[];
      }) => {
        const cards = e.snapshot.map((c) => ({
          cardId: c.card_id,
          playerId: c.player_id,
          position: c.position,
          ...(state.period.rules.rarityVersion
            ? {
                rarity: c.tier,
                multiplierTenths: c.multiplierTenths,
                rarityVersion: c.rarityVersion,
              }
            : {}),
        }));
        validateLineup(state.period.rules, cards);
        if (
          cards.some(
            (c) =>
              !state.period.fixtures.some((f) =>
                f.playerIds.includes(c.playerId),
              ),
          )
        )
          throw Error("Locked player fixture mapping absent");
        return {
          member: e.user_id,
          name: "Your team",
          cards,
          lockedAt: state.period.locksAt,
          rulesHash: digest(state.period.rules),
        };
      },
    );
    next.lineupsLockedAt = new Date(round.locked_at).toISOString();
    next.audits.push({
      sequence: next.audits.length + 1,
      actor: "nfl-round-worker",
      action: "member-lineups-locked",
      at: next.lineupsLockedAt,
      reason:
        "Persisted pre-deadline member entries; owned cards remain transfer-locked",
      payloadHash: digest(next.entries),
    });
    return next;
  });
  return true;
}
