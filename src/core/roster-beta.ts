import { fixtureSports, isFixtureSport } from "./fixture-sports";
import type { EconomyPlayer } from "./card-economy";

/** A real identity is not synthetic statistics, and test ownership is not permanent issuance. */
export type RosterBetaEvidence = {
  catalogue: string;
  canonicalPlayerId: string;
  wikidataId: string;
  rosterSource: string;
  profileSource: string;
  verifiedAt: string;
  sourceHash: string;
  license: "CC-BY-SA-4.0";
  verification: "roster-and-profile-agreement";
  permanentIssuanceEligible: false;
};
export function isRosterBetaPlayer(p: EconomyPlayer): boolean {
  const r = p.rosterBeta;
  const sport = p.sport;
  if (!isFixtureSport(sport)) return false;
  return !!(
    isFixtureSport(p.sport) &&
    p.inventoryClass === "real-roster-beta-v1" &&
    p.synthetic === false &&
    p.provider === "wikimedia" &&
    r &&
    /^Q[1-9][0-9]*$/.test(r.wikidataId) &&
    p.id === `${fixtureSports[p.sport].prefix}-roster-beta-${r.wikidataId}` &&
    p.providerId === `${p.sport}:${r.wikidataId}` &&
    p.fixturePlayerId === r.canonicalPlayerId &&
    /^[0-9a-f-]{36}$/.test(r.canonicalPlayerId) &&
    /^[0-9a-f]{64}$/.test(r.sourceHash) &&
    r.license === "CC-BY-SA-4.0" &&
    r.verification === "roster-and-profile-agreement" &&
    r.permanentIssuanceEligible === false &&
    r.rosterSource.startsWith("https://en.wikipedia.org/") &&
    r.profileSource.startsWith("https://en.wikipedia.org/") &&
    Number.isFinite(Date.parse(r.verifiedAt)) &&
    (fixtureSports[p.sport].positions as readonly string[]).includes(
      p.position,
    ) &&
    p.eligiblePositions?.length &&
    p.eligiblePositions.includes(p.position) &&
    p.eligiblePositions.every((x) =>
      (fixtureSports[sport].positions as readonly string[]).includes(x),
    )
  );
}
