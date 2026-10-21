import { createHash } from "node:crypto";
import {
  scorePlayer,
  validateLineup,
  lockRarity,
  type Rules,
  type LockedCard,
  type ScoringSport,
} from "./scoring-v1";
import { rarityPoints } from "./card-rarity";
import { syntheticProvider, type SourceSnapshot } from "./scoring-provider";
import {
  validateAuthorisedScoring,
  type AuthorisedScoringSnapshot,
} from "./authorised-scoring-feed";

// Server/operator module. No browser write endpoint imports this engine.
export const digest = (value: unknown): string => {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
};
export type CatalogCard = LockedCard & {
  owner: string;
  sport: ScoringSport;
  eligible: boolean;
};
export type Period = {
  competitionMode?: "SALARY_CAP" | "OPEN";
  lineupVersion?: string;
  inventoryScope?: "invited-nfl-test-v2";
  id: string;
  sport: ScoringSport;
  /** Explicit UTC instants: start inclusive, end exclusive. No implicit NFL week. */
  window?: { start: string; end: string; timezone: string };
  /** Confirmed official blank-gameweek membership, never inferred from absent rows. */
  blankPlayerIds?: string[];
  label: string;
  locksAt: string;
  rules: Rules;
  fixtures: { id: string; playerIds: string[]; scheduledAt: string }[];
};
export type Entry = {
  member: string;
  name: string;
  cards: (LockedCard & {
    slot?: string;
    slotLockedAt?: string | null;
    fixtureId?: string;
  })[];
  lockedAt: string;
  rulesHash: string;
};
export type Audit = {
  sequence: number;
  actor: string;
  action: string;
  at: string;
  reason: string;
  payloadHash: string;
};
export type ScoringState = {
  schemaVersion: 1;
  scope: "simulated-beta" | "authorised-free-beta";
  period: Period;
  entries: Entry[];
  sources: (SourceSnapshot | AuthorisedScoringSnapshot)[];
  audits: Audit[];
  finalisedAt: string | null;
  lineupsLockedAt: string | null;
};
export type Operator = { id: string; role: "importer" | "reviewer" };
function time(value: string) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) throw Error("Invalid time");
  return t;
}
function audit(
  s: ScoringState,
  actor: string,
  action: string,
  at: string,
  reason: string,
  payload: unknown,
) {
  time(at);
  s.audits.push({
    sequence: s.audits.length + 1,
    actor,
    action,
    at,
    reason,
    payloadHash: digest(payload),
  });
}
export function createPeriod(p: Period, at: string): ScoringState {
  if (p.sport !== p.rules.sport || !p.rules.beta || !p.id.startsWith("sim:"))
    throw Error("Only isolated simulated beta periods are enabled");
  if (
    time(at) >= time(p.locksAt) ||
    (p.fixtures.length === 0 && !p.blankPlayerIds?.length) ||
    new Set(p.fixtures.map((f) => f.id)).size !== p.fixtures.length
  )
    throw Error("Invalid period or lock");
  if (p.sport === "basketball" && !p.window)
    throw Error("NBA requires an explicit weekly scoring window");
  if (p.window) {
    if (
      ![p.window.start, p.window.end].every((v) =>
        /(?:Z|[+-]\d{2}:\d{2})$/.test(v),
      ) ||
      typeof p.window.timezone !== "string" ||
      !p.window.timezone.trim()
    )
      throw Error("Explicit scoring instants and timezone required");
    if (
      time(p.window.start) >= time(p.window.end) ||
      time(p.locksAt) > time(p.window.start)
    )
      throw Error("Invalid scoring window");
    try {
      new Intl.DateTimeFormat("en", { timeZone: p.window.timezone }).format();
    } catch {
      throw Error("Invalid scoring timezone");
    }
    if (
      p.fixtures.some(
        (f) =>
          time(f.scheduledAt) < time(p.window!.start) ||
          time(f.scheduledAt) >= time(p.window!.end),
      )
    )
      throw Error("Fixture outside frozen scoring window");
  }
  if (
    p.blankPlayerIds &&
    (p.sport !== "epl" ||
      !p.window ||
      new Set(p.blankPlayerIds).size !== p.blankPlayerIds.length ||
      p.blankPlayerIds.some((id) =>
        p.fixtures.some((f) => f.playerIds.includes(id)),
      ))
  )
    throw Error("Invalid confirmed blank-gameweek mapping");
  for (const f of p.fixtures) {
    if (
      !f.id.startsWith(`sim:${p.sport}:`) ||
      time(f.scheduledAt) < time(p.locksAt) ||
      new Set(f.playerIds).size !== f.playerIds.length
    )
      throw Error("Invalid fixture mapping or deadline");
  }
  if (!Number.isInteger(p.rules.correctionHours) || p.rules.correctionHours < 1)
    throw Error("Invalid correction window");
  const state: ScoringState = {
    schemaVersion: 1,
    scope: "simulated-beta",
    period: structuredClone(p),
    entries: [],
    sources: [],
    audits: [],
    finalisedAt: null,
    lineupsLockedAt: null,
  };
  audit(
    state,
    "operator",
    "period-created",
    at,
    "Synthetic scenario; no official assets",
    p,
  );
  return state;
}
export function saveTeam(
  state: ScoringState,
  member: string,
  name: string,
  cardIds: string[],
  catalog: CatalogCard[],
  at: string,
): ScoringState {
  if (
    time(at) >= time(state.period.locksAt) ||
    state.lineupsLockedAt ||
    state.finalisedAt
  )
    throw Error("Lineup locked");
  const cards = cardIds.map((id) => {
    const c = catalog.find((c) => c.cardId === id);
    if (
      !c ||
      c.owner !== member ||
      !c.eligible ||
      c.sport !== state.period.sport ||
      (!state.period.fixtures.some((f) => f.playerIds.includes(c.playerId)) &&
        !state.period.blankPlayerIds?.includes(c.playerId))
    )
      throw Error("Card ownership or eligibility denied");
    return {
      cardId: c.cardId,
      playerId: c.playerId,
      position: c.position,
      ...lockRarity(state.period.rules, c),
    };
  });
  validateLineup(state.period.rules, cards);
  const next = structuredClone(state);
  next.entries = next.entries.filter((e) => e.member !== member);
  next.entries.push({
    member,
    name,
    cards,
    lockedAt: state.period.locksAt,
    rulesHash: digest(state.period.rules),
  });
  audit(
    next,
    member,
    "team-saved",
    at,
    "Ownership checked at submission; roster fixed at deadline",
    cards,
  );
  return next;
}
export function lockTeams(
  state: ScoringState,
  catalog: CatalogCard[],
  at: string,
): ScoringState {
  if (state.lineupsLockedAt) return structuredClone(state);
  if (time(at) < time(state.period.locksAt) || !state.entries.length)
    throw Error("Lock deadline not reached");
  for (const e of state.entries)
    for (const c of e.cards) {
      const owned = catalog.find((x) => x.cardId === c.cardId);
      if (
        !owned ||
        !owned.eligible ||
        owned.owner !== e.member ||
        owned.sport !== state.period.sport ||
        owned.playerId !== c.playerId ||
        owned.position !== c.position ||
        (state.period.rules.rarityVersion &&
          JSON.stringify(lockRarity(state.period.rules, owned)) !==
            JSON.stringify(lockRarity(state.period.rules, c)))
      )
        throw Error("Lineup eligibility changed before lock");
    }
  const next = structuredClone(state);
  next.lineupsLockedAt = at;
  audit(
    next,
    "operator",
    "lineups-locked",
    at,
    "Ownership, eligibility and positions checked at lock",
    next.entries,
  );
  return next;
}
export function importStatistics(
  state: ScoringState,
  input: unknown,
  operator: Operator,
  at: string,
  lateReason?: string,
  approval?: unknown,
): ScoringState {
  if (!["importer", "reviewer"].includes(operator.role) || !operator.id)
    throw Error("Operator required");
  if (time(at) < time(state.period.locksAt) || !state.lineupsLockedAt)
    throw Error("Statistics before lineup lock");
  const fixtureId = (input as { fixtureId?: string })?.fixtureId;
  const fixture = state.period.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw Error("Unmapped fixture");
  const source =
    state.scope === "simulated-beta"
      ? syntheticProvider.normalize(
          input,
          state.period.sport,
          fixture.id,
          fixture.playerIds,
          state.period.rules.version,
        )
      : validateAuthorisedScoring(
          input,
          approval,
          {
            sport: state.period.sport,
            fixtureId: fixture.id,
            playerIds: fixture.playerIds,
            scoringVersion: state.period.rules.version,
          },
          at,
        );
  if (time(source.observedAt) > time(at))
    throw Error("Future source observation");
  const old = state.sources.filter((s) => s.fixtureId === fixture.id).at(-1);
  const same = state.sources.find(
    (s) => s.fixtureId === fixture.id && s.revision === source.revision,
  );
  if (same) {
    if (digest(same) !== digest(source))
      throw Error("Conflicting source revision");
    return structuredClone(state);
  }
  if (old && source.revision <= old.revision)
    throw Error("Out-of-order correction");
  if (
    old?.completionObservedAt &&
    source.completionObservedAt !== old.completionObservedAt
  )
    throw Error("First completion observation cannot change");
  const firstEnded = state.sources.find(
    (s) => s.fixtureId === fixture.id && (s.endedAt || s.completionObservedAt),
  );
  const firstCompletion =
    firstEnded?.endedAt ?? firstEnded?.completionObservedAt;
  const cutoff = firstCompletion
    ? time(firstCompletion) + state.period.rules.correctionHours * 3600000
    : Infinity;
  if (state.finalisedAt || time(at) > cutoff) {
    if (
      operator.role !== "reviewer" ||
      !lateReason ||
      lateReason.trim().length < 12
    )
      throw Error("Authorised late correction with reason required");
  }
  const next = structuredClone(state);
  next.sources.push(source);
  next.finalisedAt = null;
  audit(
    next,
    operator.id,
    old ? "statistics-corrected" : "statistics-imported",
    at,
    lateReason ?? "Within provisional correction window",
    source,
  );
  return next;
}
export function results(state: ScoringState) {
  const rows = state.entries.map((entry) => {
    if (entry.rulesHash !== digest(state.period.rules))
      throw Error("Locked ruleset changed");
    if (state.period.rules.rarityVersion)
      validateLineup(state.period.rules, entry.cards);
    const players = entry.cards.map((card) => {
      const matches = state.period.fixtures
        .filter((f) => f.playerIds.includes(card.playerId))
        .map((f) => {
          const source = state.sources
            .filter((s) => s.fixtureId === f.id)
            .at(-1);
          const player = source?.players.find(
            (p) => p.playerId === card.playerId,
          );
          const resolved =
            (!state.period.lineupVersion || !!card.slotLockedAt) &&
            source?.status === "completed" &&
            player &&
            player.availability !== "pending";
          const score = resolved
            ? player.availability === "complete"
              ? scorePlayer(state.period.rules, card.position, player.stats)
              : {
                  centipoints: 0,
                  parts: [
                    {
                      statistic: player.availability,
                      quantity: 1,
                      centipoints: 0,
                    },
                  ],
                }
            : null;
          return {
            fixtureId: f.id,
            revision: source?.revision ?? null,
            sourceStatus: source?.status ?? "missing",
            status: score
              ? state.finalisedAt
                ? "final"
                : "provisional"
              : "pending-data",
            updatedAt: source?.observedAt ?? null,
            statistics: player?.stats ?? null,
            availability: player?.availability ?? "pending",
            score,
          };
        });
      const base =
        matches.length > 0 && matches.every((m) => m.score !== null)
          ? matches.reduce((n, m) => n + m.score!.centipoints, 0)
          : matches.length === 0 &&
              state.period.blankPlayerIds?.includes(card.playerId)
            ? 0
            : null;
      return {
        ...card,
        matches,
        ...(state.period.rules.rarityVersion
          ? { baseCentipoints: base, multiplier: card.multiplierTenths! / 10 }
          : {}),
        centipoints:
          base === null
            ? null
            : state.period.rules.rarityVersion
              ? rarityPoints(base, card.multiplierTenths!)
              : base,
      };
    });
    const complete = players.every((p) => p.centipoints !== null);
    return {
      member: entry.member,
      name: entry.name,
      players,
      centipoints: complete
        ? players.reduce((n, p) => n + p.centipoints!, 0)
        : null,
      knownCentipoints: players.reduce(
        (n, p) =>
          n +
          (state.period.rules.rarityVersion
            ? rarityPoints(
                p.matches.reduce((m, f) => m + (f.score?.centipoints ?? 0), 0),
                p.multiplierTenths!,
              )
            : p.matches.reduce((m, f) => m + (f.score?.centipoints ?? 0), 0)),
        0,
      ),
      status: complete
        ? state.finalisedAt
          ? "final"
          : "provisional"
        : "pending-data",
      rank: null as number | null,
    };
  });
  // No ranking while any entrant is missing required statistics; partial totals shown separately.
  rows.sort(
    (a, b) =>
      (b.centipoints ?? -Infinity) - (a.centipoints ?? -Infinity) ||
      a.member.localeCompare(b.member),
  );
  if (rows.every((r) => r.centipoints !== null))
    rows.forEach((r, i) => {
      r.rank =
        i && r.centipoints === rows[i - 1].centipoints
          ? rows[i - 1].rank
          : i + 1;
    });
  return {
    sport: state.period.sport,
    period: state.period.label,
    rulesVersion: state.period.rules.version,
    simulated: state.scope === "simulated-beta",
    updatedAt: state.audits.at(-1)!.at,
    rows,
  };
}
/** Read projection only: preserve the historical stored result/journal shape. */
export function scoringCompletion(
  row: ReturnType<typeof results>["rows"][number],
) {
  return {
    completedPlayers: row.players.filter((p) => p.centipoints !== null).length,
    totalPlayers: row.players.length,
  };
}
export function finalise(
  state: ScoringState,
  operator: Operator,
  at: string,
): ScoringState {
  if (operator.role !== "reviewer") throw Error("Reviewer required");
  if (state.finalisedAt) return structuredClone(state);
  if (
    !state.lineupsLockedAt ||
    time(at) < time(state.period.locksAt) ||
    (state.period.window && time(at) < time(state.period.window.end))
  )
    throw Error("Scoring period remains open");
  if (
    !state.entries.length ||
    results(state).rows.some((r) => r.centipoints === null)
  )
    throw Error("Pending data cannot be finalised");
  for (const f of state.period.fixtures) {
    const s = state.sources.filter((s) => s.fixtureId === f.id).at(-1);
    if (
      !(s?.endedAt ?? s?.completionObservedAt) ||
      s.status !== "completed" ||
      time(at) <
        time((s.endedAt ?? s.completionObservedAt)!) +
          state.period.rules.correctionHours * 3600000
    )
      throw Error("Correction window remains open");
  }
  const next = structuredClone(state);
  next.finalisedAt = at;
  audit(
    next,
    operator.id,
    "finalised",
    at,
    "All required data complete; correction window elapsed",
    results(next),
  );
  return next;
}
