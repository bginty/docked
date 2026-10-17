/** Operator-reviewed bridge. Provider IDs are confined to review evidence, never
 * inferred from feed canonical IDs or names. Existing Docked IDs always win. */
import { officialPositionMatches } from "../core/nfl-card-eligibility";
export type TestingPositionReview = {
  providerId: string;
  canonical: string;
  sourcePosition: string;
  fantasyPosition: string;
  officialPosition: string;
  sourceUrl: string;
  sourceHash: string;
  reason: string;
};
export function reviewTestingIdentities(
  catalogue: { id: string; providerId: string; position: string }[],
  evidence: { canonical_id: string; external_id: string; position: string }[],
  positionReviews: TestingPositionReview[] = [],
) {
  const approved: {
    canonical: string;
    docked: string;
    position: string;
    verifiedIdentity: string;
  }[] = [];
  const quarantined: string[] = [];
  const noAppearances: string[] = [];
  for (const player of catalogue) {
    const matches = evidence.filter((e) => e.external_id === player.providerId);
    const uniqueProvider =
      !!player.providerId.trim() &&
      catalogue.filter((p) => p.providerId === player.providerId).length ===
        1 &&
      catalogue.filter((p) => p.id === player.id).length === 1;
    if (
      uniqueProvider &&
      !matches.length &&
      ["QB", "RB", "WR", "TE"].includes(player.position)
    ) {
      // The service creates canonical entities from observations. Absence here
      // means no recorded appearance in this dataset, never zero/DNP or a guess.
      noAppearances.push(player.id);
      continue;
    }
    const reviews = positionReviews.filter(
      (r) => r.providerId === player.providerId,
    );
    const reviewedPosition =
      matches.length === 1 &&
      reviews.length === 1 &&
      reviews[0].canonical === matches[0].canonical_id &&
      reviews[0].sourcePosition === matches[0].position &&
      reviews[0].fantasyPosition === player.position &&
      officialPositionMatches(reviews[0].officialPosition, player.position) &&
      reviews[0].sourceUrl.startsWith("https://") &&
      /^[a-f0-9]{64}$/.test(reviews[0].sourceHash) &&
      reviews[0].reason.trim().length > 0;
    if (
      !uniqueProvider ||
      matches.length !== 1 ||
      evidence.filter((e) => e.canonical_id === matches[0].canonical_id)
        .length !== 1 ||
      (matches[0].position !== player.position && !reviewedPosition) ||
      !["QB", "RB", "WR", "TE"].includes(player.position)
    ) {
      quarantined.push(player.id);
      continue;
    }
    approved.push({
      canonical: matches[0].canonical_id,
      docked: player.id,
      position: player.position,
      verifiedIdentity: player.providerId,
    });
  }
  return { approved, quarantined, noAppearances };
}
