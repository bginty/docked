import { createHash } from "node:crypto";
import {
  scorePlayer,
  validateLineup,
  type Rules,
  type LockedCard,
  type Sport,
} from "./scoring-v1";
import { syntheticProvider, type SourceSnapshot } from "./scoring-provider";

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
  sport: Sport;
  eligible: boolean;
};
export type Period = {
  id: string;
  sport: Sport;
  label: string;
  locksAt: string;
  rules: Rules;
  fixtures: { id: string; playerIds: string[]; scheduledAt: string }[];
};
export type Entry = {
  member: string;
  name: string;
  cards: LockedCard[];
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
  scope: "simulated-beta";
  period: Period;
  entries: Entry[];
  sources: SourceSnapshot[];
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
    p.fixtures.length === 0 ||
    new Set(p.fixtures.map((f) => f.id)).size !== p.fixtures.length
  )
    throw Error("Invalid period or lock");
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
      !state.period.fixtures.some((f) => f.playerIds.includes(c.playerId))
    )
      throw Error("Card ownership or eligibility denied");
    return { cardId: c.cardId, playerId: c.playerId, position: c.position };
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
        owned.position !== c.position
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
): ScoringState {
  if (!["importer", "reviewer"].includes(operator.role) || !operator.id)
    throw Error("Operator required");
  if (time(at) < time(state.period.locksAt) || !state.lineupsLockedAt)
    throw Error("Statistics before lineup lock");
  const fixtureId = (input as { fixtureId?: string })?.fixtureId;
  const fixture = state.period.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw Error("Unmapped fixture");
  const source = syntheticProvider.normalize(
    input,
    state.period.sport,
    fixture.id,
    fixture.playerIds,
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
  const firstEnded = state.sources.find(
    (s) => s.fixtureId === fixture.id && s.endedAt,
  )?.endedAt;
  const cutoff = firstEnded
    ? time(firstEnded) + state.period.rules.correctionHours * 3600000
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
      return {
        ...card,
        matches,
        centipoints: matches.every((m) => m.score !== null)
          ? matches.reduce((n, m) => n + m.score!.centipoints, 0)
          : null,
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
          n + p.matches.reduce((m, f) => m + (f.score?.centipoints ?? 0), 0),
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
    simulated: true as const,
    updatedAt: state.audits.at(-1)!.at,
    rows,
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
    !state.entries.length ||
    results(state).rows.some((r) => r.centipoints === null)
  )
    throw Error("Pending data cannot be finalised");
  for (const f of state.period.fixtures) {
    const s = state.sources.filter((s) => s.fixtureId === f.id).at(-1);
    if (
      !s?.endedAt ||
      s.status !== "completed" ||
      time(at) < time(s.endedAt) + state.period.rules.correctionHours * 3600000
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
