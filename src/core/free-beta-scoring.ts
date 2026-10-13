import { digest, type Period, type ScoringState } from "./scoring-engine";
import { currentRulesets } from "./scoring-release";
import { nflRarityRules } from "./scoring-v1";
import { nflSeven, sevenRules } from "./nfl-seven";

/** Internal operator configuration, never a client POST. A complete mapped round
 * and the existing whole-round lock policy are required before registration. */
export function createFreeBetaPeriod(
  p: Period,
  at: string,
  evidence: {
    source: string;
    verifiedAt: string;
    completeRound: boolean;
    lockPolicy: "whole-round-before-first-kickoff";
    offsetSeconds: number;
  },
): ScoringState {
  const now = Date.parse(at),
    verified = Date.parse(evidence.verifiedAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(verified) ||
    verified > now ||
    now - verified > 3600000 ||
    !evidence.completeRound ||
    !/^https:\/\//.test(evidence.source) ||
    evidence.lockPolicy !== "whole-round-before-first-kickoff" ||
    !Number.isInteger(evidence.offsetSeconds) ||
    evidence.offsetSeconds < 0 ||
    !/^beta-real:[a-z0-9:_-]+$/.test(p.id) ||
    !["epl", "nfl"].includes(p.sport) ||
    (p.inventoryScope === "invited-nfl-test-v2"
      ? p.sport !== "nfl" ||
        (p.lineupVersion
          ? p.lineupVersion !== nflSeven.version ||
            !["SALARY_CAP", "OPEN"].includes(p.competitionMode ?? "") ||
            !p.id.startsWith("beta-real:nfl:seven:") ||
            digest(p.rules) !== digest(sevenRules())
          : !p.id.startsWith("beta-real:nfl:rarity-test:") ||
            digest(p.rules) !== digest(nflRarityRules()))
      : !!p.rules.rarityVersion ||
        digest(p.rules) !== digest(currentRulesets[p.sport])) ||
    !p.fixtures.length
  )
    throw Error("Verified free-beta round configuration required");
  const first = Math.min(...p.fixtures.map((f) => Date.parse(f.scheduledAt)));
  const lock = first - evidence.offsetSeconds * 1000;
  if (
    !Number.isFinite(lock) ||
    now >= lock ||
    Date.parse(p.locksAt) !== lock ||
    new Set(p.fixtures.map((f) => f.id)).size !== p.fixtures.length ||
    p.fixtures.some(
      (f) =>
        !f.playerIds.length || new Set(f.playerIds).size !== f.playerIds.length,
    )
  )
    throw Error("Round started, incomplete mapping or invalid deadline");
  return {
    schemaVersion: 1,
    scope: "authorised-free-beta",
    period: structuredClone(p),
    entries: [],
    sources: [],
    finalisedAt: null,
    lineupsLockedAt: null,
    audits: [
      {
        sequence: 1,
        actor: "operator",
        action: "period-created",
        at,
        reason: "Verified complete free-beta round; no commercial inventory",
        payloadHash: digest({ p, evidence }),
      },
    ],
  };
}
